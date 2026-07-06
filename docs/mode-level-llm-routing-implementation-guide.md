# Mode 级 LLM 路由落地方案（实施指南）

> 本文档基于 [`mode-level-llm-routing-migration-plan.md`](./mode-level-llm-routing-migration-plan.md) 的产品设计，在对现有代码库逐项核实后，给出可直接执行的工程落地方案。
> 文档 2（mode-handoff-summary）不在本批范围内，但本方案在 Phase 4 预留了对接点。
>
> **重要**：本方案包含 Multi-Model Orchestration 的**完整物理删除清单**（Phase 6），分两步走——先退场（Phase A 隐藏入口），新方案稳定后再物理删代码（Phase B 清理）。

---

## 0. 现状核实结论（对文档假设的逐项验证）

在动手前，先澄清一个**最关键的事实**，它会影响整个实施策略：

### 0.1 `modeApiConfigs` 已经是 Mode → Profile 的绑定表

- [`packages/types/src/global-settings.ts:197`](../packages/types/src/global-settings.ts:197) 已定义 `modeApiConfigs: z.record(z.string(), z.string()).optional()`
- [`src/core/config/ProviderSettingsManager.ts:39`](../src/core/config/ProviderSettingsManager.ts:39) 中 `modeApiConfigs` 存储的是 **configId**（不是 profile name），通过 [`getModeConfigId(mode)`](../src/core/config/ProviderSettingsManager.ts:529) / [`setModeConfig(mode, configId)`](../src/core/config/ProviderSettingsManager.ts:509) 读写
- **结论**：文档 5.1 节"复用 `modeApiConfigs`"的假设成立，无需新建配置表

### 0.2 `lockApiConfigAcrossModes` 已经实现了"Mode 切换时是否换 profile"的开关

这是最重要的发现。当前 [`ClineProvider.handleModeSwitch()`](../src/core/webview/ClineProvider.ts:1376) 的逻辑是：

```
lockApiConfigAcrossModes = true  → 切 Mode 时不加载 mode-specific config（= 文档的 routing disabled）
lockApiConfigAcrossModes = false → 切 Mode 时加载 modeApiConfigs[mode]（= 文档的 routing enabled）
```

也就是说，**文档要的"Mode 级路由"核心行为，在 `lockApiConfigAcrossModes = false` 时已经存在**。文档要做的本质是：

1. 把这个开关的**语义反转 + 重命名**（`lock=true` ⇔ `routing=false`），让产品表达更清晰
2. 把散落在 `handleModeSwitch` / task 恢复 / `submitUserMessage` 的判定逻辑**收口到一个 resolver**
3. 补齐计价/上下文的多模型展示

### 0.3 其他已确认的落点

| 文档假设 | 代码现状 | 结论 |
|---|---|---|
| `modeApiConfigs` 存在 | [`global-settings.ts:197`](../packages/types/src/global-settings.ts:197) | ✅ 成立 |
| `getModeConfigId()` 存在 | [`ProviderSettingsManager.ts:529`](../src/core/config/ProviderSettingsManager.ts:529) | ✅ 成立 |
| `activateProviderProfile()` 存在 | [`ClineProvider.ts:1620`](../src/core/webview/ClineProvider.ts:1620) | ✅ 成立 |
| `setMode()` / `setProviderProfile()` 存在 | [`ClineProvider.ts:3233`](../src/core/webview/ClineProvider.ts:3233) / [`:3249`](../src/core/webview/ClineProvider.ts:3249) | ✅ 成立 |
| `submitUserMessage(text, images, mode, providerProfile)` 存在 | [`Task.ts:1401`](../src/core/task/Task.ts:1401) | ✅ 成立 |
| task 级 `mode + apiConfigName` 持久化 | [`Task.ts:477`](../src/core/task/Task.ts:477) / [`:1047`](../src/core/task/Task.ts:1047) | ✅ 成立 |
| `lockApiConfigAcrossModes` 存在 | [`vscode-extension-host.ts:316`](../packages/types/src/vscode-extension-host.ts:316)（workspaceState） | ✅ 成立 |
| `clineMessageSchema` 有 `modelId` | [`message.ts:290`](../packages/types/src/message.ts:290) | ✅ 成立，但缺 `mode`/`providerProfile` 归因字段 |
| `consolidateTokenUsage()` 只做总量 | [`consolidateTokenUsage.ts:29`](../packages/core/src/message-utils/consolidateTokenUsage.ts:29) | ✅ 成立，需新增多模型聚合 |
| `TaskHeader` 按 contextWindow/contextTokens 计算 | [`TaskHeader.tsx:65`](../webview-ui/src/components/chat/TaskHeader.tsx:65) | ✅ 成立 |
| `WebviewMessage` 有 `lockApiConfigAcrossModes` | [`vscode-extension-host.ts:572`](../packages/types/src/vscode-extension-host.ts:572) | ✅ 成立，需新增路由开关消息 |

---

## 1. 关键设计决策

### 1.1 开关语义：新增 `modeLevelLlmRoutingEnabled`，与 `lockApiConfigAcrossModes` 互为反义

```
modeLevelLlmRoutingEnabled = true   ⇔ lockApiConfigAcrossModes = false  （按 Mode 切换 profile）
modeLevelLlmRoutingEnabled = false  ⇔ lockApiConfigAcrossModes = true   （锁定全局 profile）
```

**短期兼容策略**（Phase 1-2）：
- 新开关优先；若新开关未设置（`undefined`），则从 `lockApiConfigAcrossModes` 反推
- 不立即删除 `lockApiConfigAcrossModes`，避免破坏老用户

**长期**（Phase 6 之后）：一次性迁移把 `lockApiConfigAcrossModes` 转换为 `modeLevelLlmRoutingEnabled`，然后下线旧字段。

### 1.2 路由判定收口到 `ModeRoutingResolver`

不再让 `handleModeSwitch`、task 恢复、`submitUserMessage` 各自写一套"要不要切 profile"的判定。统一调 resolver：

```ts
resolveProfileForMode({
  mode, explicitProviderProfile, currentTaskApiConfigName,
  currentGlobalApiConfigName, modeApiConfigs, modeLevelLlmRoutingEnabled
}): string | undefined
```

### 1.3 `modeApiConfigs` 存 configId，resolver 返回的也是 configId

注意：`modeApiConfigs[mode]` 存的是 **configId**，不是 profile name。resolver 返回 configId 后，由 `ClineProvider` 负责把 configId 解析成 profile name 再 `activateProviderProfile`。这条边界要守住，避免 resolver 越权访问 `ProviderSettingsManager.listConfig()`。

### 1.4 计价与上下文展示拆成两套口径（Phase 5）

- **累计口径**（全 task、所有模型）：费用、Token 总量 → 复用并扩展 `consolidateTokenUsage`
- **当前口径**（当前生效模型）：contextWindow、已用、可用 → 由 `TaskHeader` 按当前 model 计算

---

## 2. 分阶段实施计划

### Phase 1：配置与路由底座

**目标**：建立统一的 Mode 选模逻辑，不改变任何运行时行为。

**任务**：

1. **新增全局开关字段**
   - 文件：[`packages/types/src/global-settings.ts`](../packages/types/src/global-settings.ts)
   - 在 `modeApiConfigs` 附近新增：
     ```ts
     /**
      * Mode-Level LLM Routing 总开关。
      * - true: 切换 Mode 时自动使用该 Mode 绑定的 Provider Profile
      * - false/undefined: 所有 Mode 使用全局 Profile（向后兼容）
      * 与 lockApiConfigAcrossModes 互为反义；新开关优先。
      */
     modeLevelLlmRoutingEnabled: z.boolean().optional(),
     ```

2. **新增 `ModeRoutingResolver`**
   - 新建文件：`src/services/mode-routing/ModeRoutingTypes.ts`
     ```ts
     export interface ResolveModeProfileInput {
       mode: string
       explicitProviderProfile?: string
       currentTaskApiConfigName?: string
       currentGlobalApiConfigName?: string
       modeApiConfigs?: Record<string, string>
       modeLevelLlmRoutingEnabled?: boolean
       lockApiConfigAcrossModes?: boolean // 兼容回退
     }
     export interface ResolveModeProfileOutput {
       configId?: string
       source: "explicit" | "mode-binding" | "task" | "global" | "none"
       routingEnabled: boolean
     }
     ```
   - 新建文件：`src/services/mode-routing/ModeRoutingResolver.ts`
     ```ts
     export function resolveProfileForMode(input: ResolveModeProfileInput): ResolveModeProfileOutput {
       const routingEnabled = resolveRoutingEnabled(input)
       if (input.explicitProviderProfile) {
         return { configId: input.explicitProviderProfile, source: "explicit", routingEnabled }
       }
       if (routingEnabled) {
         const bound = input.modeApiConfigs?.[input.mode]
         if (bound) return { configId: bound, source: "mode-binding", routingEnabled }
       }
       if (input.currentTaskApiConfigName) {
         return { configId: input.currentTaskApiConfigName, source: "task", routingEnabled }
       }
       return { configId: input.currentGlobalApiConfigName, source: "global", routingEnabled }
     }

     function resolveRoutingEnabled(input: ResolveModeProfileInput): boolean {
       if (input.modeLevelLlmRoutingEnabled !== undefined) return input.modeLevelLlmRoutingEnabled
       // 兼容回退：lockApiConfigAcrossModes 是反义
       return !(input.lockApiConfigAcrossModes ?? false)
     }
     ```
   - 新建文件：`src/services/mode-routing/index.ts`（导出）

3. **补基础单测**
   - 新建：`src/services/mode-routing/__tests__/ModeRoutingResolver.spec.ts`
   - 覆盖：routing disabled 走全局、routing enabled 走 mode-binding、explicit 优先、mode 未配置回退、`lockApiConfigAcrossModes` 反义映射

**完成标准**：resolver 能根据开关返回正确 configId 与 source；单测全绿；**此时不接入任何运行时路径**。

---

### Phase 2：Provider 接入（让切 Mode 真正走 resolver）

**目标**：把 `handleModeSwitch` 和 task 恢复的 profile 判定改为调 resolver。

**任务**：

1. **改造 [`ClineProvider.handleModeSwitch(newMode)`](../src/core/webview/ClineProvider.ts:1376)**
   - 读取 `modeLevelLlmRoutingEnabled`（globalState）和 `lockApiConfigAcrossModes`（workspaceState）
   - 读取 `modeApiConfigs`、`currentApiConfigName`、当前 task 的 `apiConfigName`
   - 调 `resolveProfileForMode(...)`
   - 根据 `source` 决定行为：
     - `source === "mode-binding"` → 用 configId 找 profile name → `activateProviderProfile({ name })`
     - `source === "global"` 或 routing disabled → 不切 profile（保持当前）
     - profile 不存在 → 降级：保持当前 profile + 记日志（不崩溃）
   - **保留**现有的"无 saved config 时把当前 config 存为 mode 默认"的兜底逻辑，但只在 routing enabled 时执行

2. **改造 task 恢复路径**（[`ClineProvider.ts:981`](../src/core/webview/ClineProvider.ts:981) 附近）
   - 把 `if (!historyItem.apiConfigName && !lockApiConfigAcrossModes && ...)` 改为调 resolver 判定
   - 恢复 task 时：优先恢复 task 自己的 `apiConfigName`；用户下次主动切 Mode 后再应用 mode-binding

3. **改造 [`submitUserMessage`](../src/core/task/Task.ts:1401) 的切换前快照**
   - 在 `provider.setMode(mode)` 之前，记录切换前的 `taskMode / taskApiConfigName`（为 Phase 4 handoff 预留，本 Phase 只记录不使用）
   - `providerProfile` 显式指定时仍走 `setProviderProfile`（= explicit 优先级，与 resolver 一致）

4. **补 Provider 行为测试**
   - 新建：`src/core/webview/__tests__/ClineProvider.mode-routing.spec.ts`
   - 覆盖：`setMode(code)` 切到 code 绑定模型、`setMode(architect)` 切到 architect 绑定模型、routing disabled 不切、profile 不存在不崩溃

**完成标准**：同一 task 切 Mode 时模型可正确切换；routing disabled 时行为与改造前一致；现有 `ClineProvider.lockApiConfig.spec.ts` / `sticky-profile.spec.ts` 不被破坏。

**风险点**：`handleModeSwitch` 现有逻辑里有"无 saved config 时把当前 config 存为 mode 默认"的副作用。改造时要确认这个副作用在 routing disabled 下不触发，否则会污染 `modeApiConfigs`。

---

### Phase 3：UI 与设置接入

**目标**：用户能管理开关和 Mode 对应模型。

**任务**：

1. **扩展 `WebviewMessage` 类型**
   - 文件：[`packages/types/src/vscode-extension-host.ts:481`](../packages/types/src/vscode-extension-host.ts:481)
   - 在 `type` 联合中新增 `"setModeLevelLlmRoutingEnabled"`
   - 同时新增 `"updateModeApiConfig"`（若现有 UI 未覆盖 mode→profile 绑定的写入）

2. **扩展 `ExtensionState`**
   - 在 [`vscode-extension-host.ts:315`](../packages/types/src/vscode-extension-host.ts:315) 的 `& {...}` 块新增 `modeLevelLlmRoutingEnabled?: boolean`
   - [`ClineProvider`](../src/core/webview/ClineProvider.ts) 的 `getState()` / `postStateToWebview()` 中补读该字段

3. **新增 webview 消息处理**
   - 文件：[`src/core/webview/webviewMessageHandler.ts`](../src/core/webview/webviewMessageHandler.ts)
   - 在 `lockApiConfigAcrossModes` case 旁新增：
     ```ts
     case "setModeLevelLlmRoutingEnabled": {
       const enabled = message.bool ?? false
       await updateGlobalState("modeLevelLlmRoutingEnabled", enabled)
       // 同步更新 lockApiConfigAcrossModes 为反义，保持双写期一致
       await provider.context.workspaceState.update("lockApiConfigAcrossModes", !enabled)
       await provider.postStateToWebview()
       break
     }
     ```

4. **UI 开关组件**
   - 方案 A（推荐，最小改动）：**复用现有锁图标**。[`ApiConfigSelector.tsx`](../webview-ui/src/components/chat/ApiConfigSelector.tsx) 已有锁图标切换 `lockApiConfigAcrossModes`。把它改为切换 `modeLevelLlmRoutingEnabled`（反义），图标语义：解锁=按 Mode 路由，锁定=全局统一。只需改 `ChatTextArea.tsx` 的 `handleToggleLockApiConfig` 发送新消息类型。
   - 方案 B：在 Settings 新增独立开关 `Enable Mode-Level LLM Routing`。位置：[`webview-ui/src/components/settings/`](../webview-ui/src/components/settings/) 下新建 `ModeRoutingSettings.tsx`，挂到 `SettingsView.tsx`。
   - **建议 A+B 都做**：A 保证日常切换便捷，B 提供正式设置入口和说明文案。

5. **Mode → Profile 绑定 UI**
   - 现有 `ApiConfigManager` / `ApiOptions` 已能写 `modeApiConfigs`（通过 `setModeConfig`）。若已有 Mode 配置区域，只需补一行"当前 Mode 的 Profile"下拉；否则在 `ModeRoutingSettings.tsx` 中为每个 Mode 增加下拉。

6. **当前生效模型标签**
   - [`TaskHeader.tsx`](../webview-ui/src/components/chat/TaskHeader.tsx) 顶部增加 `Architect · GPT-5.5` 标签（当前 Mode + 当前 modelId），数据来自 `apiConfiguration` + `taskMode`

7. **补 UI 测试**
   - `webview-ui/src/components/chat/__tests__/ChatTextArea.mode-routing.spec.tsx`
   - `webview-ui/src/components/settings/__tests__/ModeRoutingSettings.spec.tsx`

**完成标准**：用户能看懂、能配置、能验证当前是否走分 Mode 模型；开关切换后 state 正确同步。

---

### Phase 4：预留 Handoff Summary 对接点（本批不实现，只留接口）

**目标**：为文档 2 的接入预留钩子，不引入 handoff 实现。

**任务**：

1. 在 [`Task.submitUserMessage`](../src/core/task/Task.ts:1401) 的切换前快照处（Phase 2 已加），补一个 `// TODO(handoff): 此处生成 mode_handoff` 注释和空函数桩 `private async maybeCreateModeHandoff(): Promise<void> { return }`
2. 在 `recursivelyMakeClineRequests` 发起 API 请求前，补 `// TODO(handoff): 此处注入 pending handoff` 注释和空函数桩 `private async consumePendingModeHandoff(): Promise<string | undefined> { return undefined }`

**完成标准**：桩函数存在、不报错、不影响行为；文档 2 实现时直接填桩。

---

### Phase 5：计价与上下文展示升级

**目标**：让多模型成本与空间展示对用户可解释、可追踪。这是独立的大块工作，可与 Phase 1-4 解耦推进。

**任务**：

1. **为 API 请求消息补充归因字段**
   - 文件：[`packages/types/src/message.ts:249`](../packages/types/src/message.ts:249) 的 `clineMessageSchema`
   - 新增：
     ```ts
     /** 本次请求所属的 Mode（归因用） */
     modeAtRequest: z.string().optional(),
     /** 本次请求使用的 Provider Profile name（归因用） */
     providerProfileAtRequest: z.string().optional(),
     ```
   - 在 [`Task.ts`](../src/core/task/Task.ts) 发起 `api_req_started` 消息时写入这两个字段

2. **新增多模型聚合结构**
   - 文件：[`packages/types/src/message.ts`](../packages/types/src/message.ts) 新增：
     ```ts
     export const usageBreakdownItemSchema = z.object({
       mode: z.string().optional(),
       profile: z.string().optional(),
       modelId: z.string().optional(),
       requestCount: z.number(),
       tokensIn: z.number(),
       tokensOut: z.number(),
       totalCost: z.number(),
     })
     export const multiModelUsageSchema = z.object({
       total: tokenUsageSchema,
       byMode: z.array(usageBreakdownItemSchema),
       byProfile: z.array(usageBreakdownItemSchema),
       currentEffectiveMode: z.string().optional(),
       currentEffectiveProfile: z.string().optional(),
       currentEffectiveModelId: z.string().optional(),
       currentContextWindow: z.number().optional(),
       reservedForOutput: z.number().optional(),
       availableSpace: z.number().optional(),
     })
     ```

3. **新增 `consolidateMultiModelUsage`**
   - 文件：[`packages/core/src/message-utils/consolidateTokenUsage.ts`](../packages/core/src/message-utils/consolidateTokenUsage.ts)
   - 保留现有 `consolidateTokenUsage()`，新增：
     ```ts
     export function consolidateMultiModelUsage(messages: ClineMessage[]): MultiModelUsage
     ```
   - 职责：统计 total + 聚合 byMode + 聚合 byProfile + 识别 currentEffective（取最后一条 `api_req_started` 的归因字段）

4. **改造 `TaskHeader` 展示**
   - 文件：[`webview-ui/src/components/chat/TaskHeader.tsx`](../webview-ui/src/components/chat/TaskHeader.tsx)
   - 收起态：`24%`（当前模型上下文占比）+ `$8.80`（task 累计费用）+ `Architect · GPT-5.5`（当前 Mode·模型）
   - 展开态：三组信息（当前模型上下文 / 任务累计统计 / 成本分摊）
   - tooltip 写清口径：累计=全 task，空间=当前模型

5. **新增 breakdown 组件**
   - `webview-ui/src/components/chat/MultiModelUsageBreakdown.tsx`
   - `webview-ui/src/components/chat/ModeCostBreakdown.tsx`
   - `webview-ui/src/components/chat/ProfileCostBreakdown.tsx`
   - 每项显示：request count / tokens in / tokens out / total cost
   - 增加 `Top Cost Mode` / `Top Cost Profile` 指标

6. **补测试**
   - `packages/core/src/message-utils/__tests__/consolidateMultiModelUsage.spec.ts`
   - `webview-ui/src/components/chat/__tests__/TaskHeader.multi-model.spec.tsx`
   - `webview-ui/src/components/chat/__tests__/MultiModelUsageBreakdown.spec.tsx`

**完成标准**：用户能区分"累计成本"和"当前模型空间"；能看出哪个 Mode/模型最烧钱；能验证多模型路由是否真的省 Token。

**注意**：归因字段 `modeAtRequest` / `providerProfileAtRequest` 只对**新增后**的请求有效。历史 task 的旧消息没有这些字段，breakdown 时归入 `unknown` 桶即可，不要强行回填。

---

### Phase 6：Orchestrator 退场与物理删除

**目标**：让旧编排器退出主流程，并最终物理删除全部 orchestrator 代码。

文档 1 第 11 节明确要求分两步：**Phase A 退场（隐藏入口）→ Phase B 物理删除（清理代码）**。
下面给出经过代码库核实的完整删除清单。

#### Phase 6A：退场（隐藏入口，保留代码）

**任务**：

1. **设置页弱化 orchestrator 入口**
   - [`webview-ui/src/components/settings/SettingsView.tsx:804`](../webview-ui/src/components/settings/SettingsView.tsx) 的 orchestrator tab 加 `legacy` / `experimental` 标签
   - [`webview-ui/src/components/settings/SettingsView.tsx:534`](../webview-ui/src/components/settings/SettingsView.tsx) 的导航项 `{ id: "orchestrator", icon: GitCommitVertical }` 移到"高级/实验"分组或隐藏

2. **聊天区隐藏 orchestrator 触发器**
   - [`webview-ui/src/components/chat/OrchestratorDropdown.tsx`](../webview-ui/src/components/chat/OrchestratorDropdown.tsx)：当 `modeLevelLlmRoutingEnabled = true` 时不渲染该下拉
   - [`webview-ui/src/components/chat/ChatTextArea.tsx:1300`](../webview-ui/src/components/chat/ChatTextArea.tsx) 的 `{!orchestratorEnabled && (...)}` 逻辑保持，但 orchestrator 开启入口弱化

3. **互斥提示**
   - 当 `orchestratorEnabled = true` 且 `modeLevelLlmRoutingEnabled = true` 同时成立时，在 UI 提示"两者互斥，建议使用 Mode 级路由"
   - 在 [`webviewMessageHandler.ts`](../src/core/webview/webviewMessageHandler.ts) 的 `orchestratorSetEnabled` case 中：若 `modeLevelLlmRoutingEnabled` 已开，则拒绝开启 orchestrator 并提示

4. **冻结扩展**
   - 停止给 [`orchestrator-config.ts`](../packages/types/src/orchestrator-config.ts) / [`OrchestratorEngine.ts`](../src/core/task/OrchestratorEngine.ts) 增加新能力

**完成标准**：用户默认只看到新的 Mode-Level LLM Routing 路径；orchestrator 仍可用但不再主推。

#### Phase 6B：物理删除（新方案稳定后执行）

**前置条件**：Phase 1-5 已上线且稳定运行至少一个迭代周期，无回归。

**删除清单（经代码库核实）**：

##### B1. 核心引擎层

| 文件 | 操作 | 说明 |
|---|---|---|
| [`src/core/task/OrchestratorEngine.ts`](../src/core/task/OrchestratorEngine.ts) | **整文件删除** | 321 行的 Mode Chain 控制器，整个类废弃 |
| [`src/core/task/Task.ts`](../src/core/task/Task.ts) | 删除 orchestrator 相关成员 | 见下方详细清单 |

[`Task.ts`](../src/core/task/Task.ts) 内需删除的具体成员（经核实）：
- [`:96`](../src/core/task/Task.ts) `import { OrchestratorEngine }`
- [`:97`](../src/core/task/Task.ts) `import type { OrchestratorModeConfig, OrchestratorModeState }`
- [`:384-389`](../src/core/task/Task.ts) `orchestratorMode` / `orchestratorEngine` / `_orchestratorState` 三个字段
- [`:410`](../src/core/task/Task.ts) `TaskOptions` 中的 `orchestratorMode`
- [`:538-548`](../src/core/task/Task.ts) 构造函数中 `if (orchestratorMode?.enabled) {...}` 分支
- [`:1604-1606`](../src/core/task/Task.ts) / [`:1642-1644`](../src/core/task/Task.ts) 两处 `!lastMessage.modelId && !lastMessage.orchestratorModelId` 判定（简化为只判 `modelId`）
- [`:2312-2322`](../src/core/task/Task.ts) `initiateTaskLoop` 中 `if (this.orchestratorMode?.enabled && this.orchestratorEngine)` 分支
- [`:2418-2421`](../src/core/task/Task.ts) `recursivelyMakeClineRequests` 中 `getCurrentOrchestratorMessageMeta()` + `sayWithOrchestratorMeta` 调用
- [`:4306-4336`](../src/core/task/Task.ts) `getCurrentOrchestratorMessageMeta()` 方法整体
- [`:4716-4718`](../src/core/task/Task.ts) `get orchestratorState()` getter
- [`:4724-4728`](../src/core/task/Task.ts) `approveOrchestratorPlan()` 方法
- [`:4735-4737`](../src/core/task/Task.ts) `cancelOrchestrator()` 方法
- [`:4740-4759`](../src/core/task/Task.ts) `sayWithOrchestratorMeta()` 方法整体

##### B2. Provider / 消息处理层

| 文件 | 操作 | 说明 |
|---|---|---|
| [`src/core/webview/ClineProvider.ts`](../src/core/webview/ClineProvider.ts) | 删除 orchestrator state 推送 | [`:2066`](../src/core/webview/ClineProvider.ts) `orchestratorSession` omit、[`:2215-2216`](../src/core/webview/ClineProvider.ts) 解构、[`:2384-2401`](../src/core/webview/ClineProvider.ts) `orchestratorSession` 快照构建、[`:2622-2623`](../src/core/webview/ClineProvider.ts) state 输出 |
| [`src/core/webview/webviewMessageHandler.ts`](../src/core/webview/webviewMessageHandler.ts) | 删除 orchestrator 消息处理 | [`:641-700`](../src/core/webview/webviewMessageHandler.ts) `orchestratorEnabled` 判定与 config 组装、[`:3664-3675`](../src/core/webview/webviewMessageHandler.ts) `orchestratorSetEnabled` / `orchestratorUpdateConfig` 两个 case |

##### B3. 类型层

| 文件 | 操作 | 说明 |
|---|---|---|
| [`packages/types/src/global-settings.ts`](../packages/types/src/global-settings.ts) | 删除字段 | [`:246-270`](../packages/types/src/global-settings.ts) `orchestratorEnabled` / `orchestratorConfig` / `orchestratorSession` |
| [`packages/types/src/message.ts`](../packages/types/src/message.ts) | 删除字段 | [`:278`](../packages/types/src/message.ts) `orchestratorRole`、[`:284`](../packages/types/src/message.ts) `orchestratorModelId` |
| [`packages/types/src/orchestrator.ts`](../packages/types/src/orchestrator.ts) | **整文件删除** | OrchestratorTask / ExecTask / ReviewTask / OrchestratorSessionState 等核心类型 |
| [`packages/types/src/orchestrator-events.ts`](../packages/types/src/orchestrator-events.ts) | **整文件删除** | OrchestratorEvent / OrchestratorWebviewPush 等事件类型 |
| [`packages/types/src/orchestrator-config.ts`](../packages/types/src/orchestrator-config.ts) | **整文件删除** | OrchestratorProviderConfig / DEFAULT_ORCHESTRATOR_CONFIG |
| [`packages/types/src/task.ts`](../packages/types/src/task.ts) | 删除类型 | [`:8-9`](../packages/types/src/task.ts) import、[`:88-156`](../packages/types/src/task.ts) `OrchestratorStageConfig` / `OrchestratorModeConfig` / `OrchestratorModeState`、TaskOptions 中的 `orchestratorMode` |
| [`packages/types/src/vscode-extension-host.ts`](../packages/types/src/vscode-extension-host.ts) | 删除字段与类型 | [`:20-21`](../packages/types/src/vscode-extension-host.ts) import、[`:105-108`](../packages/types/src/vscode-extension-host.ts) 注释、[`:398-401`](../packages/types/src/vscode-extension-host.ts) `orchestratorEnabled/Config/Session`、[`:404-455`](../packages/types/src/vscode-extension-host.ts) `OrchestratorStageInfo` / `OrchestratorSessionSnapshot`、[`:659-663`](../packages/types/src/vscode-extension-host.ts) WebviewMessage 中的 `orchestratorSetEnabled/UpdateConfig/ApprovePlan/Cancel`、[`:783`](../packages/types/src/vscode-extension-host.ts) `sessionId` |
| [`packages/types/src/index.ts`](../packages/types/src/index.ts) | 删除导出 | [`:35-37`](../packages/types/src/index.ts) `export * from "./orchestrator*"` 三行 |

##### B4. Webview UI 层

| 文件 | 操作 | 说明 |
|---|---|---|
| `webview-ui/src/components/orchestrator/` | **整目录删除** | `OrchestratorSettings.tsx`/`OrchestratorSessionPanel.tsx`/`OrchestratorToggle.tsx` 全部 |
| [`webview-ui/src/components/chat/OrchestratorDropdown.tsx`](../webview-ui/src/components/chat/OrchestratorDropdown.tsx) | **整文件删除** | 聊天区 orchestrator 下拉 |
| [`webview-ui/src/components/chat/ChatRow.tsx`](../webview-ui/src/components/chat/ChatRow.tsx) | 删除渲染分支 | [`:1189-1202`](../webview-ui/src/components/chat/ChatRow.tsx) `orchestratorRole` / `orchestratorModelId` 的 role 图标渲染 |
| [`webview-ui/src/components/chat/ChatTextArea.tsx`](../webview-ui/src/components/chat/ChatTextArea.tsx) | 删除引用 | [`:101`](../webview-ui/src/components/chat/ChatTextArea.tsx) `orchestratorEnabled`、[`:1300-1301`](../webview-ui/src/components/chat/ChatTextArea.tsx) 条件分支 |
| [`webview-ui/src/components/chat/ChatView.tsx`](../webview-ui/src/components/chat/ChatView.tsx) | 删除引用 | [`:46`](../webview-ui/src/components/chat/ChatView.tsx) import、[`:90-91`](../webview-ui/src/components/chat/ChatView.tsx) `orchestratorSession/Enabled`、[`:1615-1619`](../webview-ui/src/components/chat/ChatView.tsx) SessionPanel 渲染 |
| [`webview-ui/src/components/settings/SettingsView.tsx`](../webview-ui/src/components/settings/SettingsView.tsx) | 删除引用 | [`:83`](../webview-ui/src/components/settings/SettingsView.tsx) import、[`:104`](../webview-ui/src/components/settings/SettingsView.tsx) tab、[`:230-240`](../webview-ui/src/components/settings/SettingsView.tsx) sync、[`:534`](../webview-ui/src/components/settings/SettingsView.tsx) 导航项、[`:804-828`](../webview-ui/src/components/settings/SettingsView.tsx) orchestrator section |
| [`webview-ui/src/context/ExtensionStateContext.tsx`](../webview-ui/src/context/ExtensionStateContext.tsx) | 删除 state | [`:153-159`](../webview-ui/src/context/ExtensionStateContext.tsx) 类型、[`:213-214`](../webview-ui/src/context/ExtensionStateContext.tsx) merge 逻辑、[`:420-505`](../webview-ui/src/context/ExtensionStateContext.tsx) 注释、[`:661-679`](../webview-ui/src/context/ExtensionStateContext.tsx) state 初始化与 setter |

##### B5. 测试层

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/core/task/__tests__/OrchestratorEngine*.spec.ts` | **删除** | 若存在 |
| [`webview-ui/src/context/__tests__/ExtensionStateContext.spec.tsx`](../webview-ui/src/context/__tests__/ExtensionStateContext.spec.tsx) | 删除 orchestrator 用例 | [`:372-463`](../webview-ui/src/context/__tests__/ExtensionStateContext.spec.tsx) `orchestratorSession` 相关测试 |
| 各 `__tests__` 中 mock 的 `orchestratorEnabled` / `orchestratorConfig` | 清理 | 全局搜索清理 mock 残留 |

##### B6. i18n / locale

| 位置 | 操作 | 说明 |
|---|---|---|
| `public/locales/*/orchestrator.json` 或 `chat:orchestrator.*` / `settings:sections.orchestrator` 键 | 删除 | 全局搜索 `orchestrator.` 翻译键并清理 |

##### B7. 数据迁移

| 位置 | 操作 | 说明 |
|---|---|---|
| 启动时一次性迁移 | 新增 | 若用户 `orchestratorEnabled = true`，提示其已迁移到 Mode 级路由并自动开启 `modeLevelLlmRoutingEnabled`；然后清除 `orchestratorEnabled/Config/Session` |

**Phase 6B 完成标准**：
- 全局搜索 `orchestrator`（不区分大小写）在 `src/` `packages/` `webview-ui/` 下**零命中**（除迁移代码和 CHANGELOG 注释外）
- `tsc` 编译无错误
- 所有测试通过
- 历史 task 中带 `orchestratorRole` 的旧消息能正常显示（`ChatRow` 删除渲染分支后，这些消息按普通消息显示，不报错）

**Phase 6B 风险点**：
- 历史 task 的 `clineMessages` 里可能存有 `orchestratorRole` / `orchestratorModelId` 字段。删除 schema 字段后，zod parse 会丢弃这些字段（`optional` 字段缺失不报错），消息仍可正常显示为普通消息。**不要**做历史数据回填。
- [`packages/types/src/task.ts`](../packages/types/src/task.ts) 的 `OrchestratorModeConfig` 被 `TaskOptions` 引用，删除后要确认 `Task` 构造函数的所有调用方不再传 `orchestratorMode`（主要在 [`webviewMessageHandler.ts:679`](../src/core/webview/webviewMessageHandler.ts)）。

---

## 3. 代码落点清单（一图速查）

| Phase | 文件 | 改动类型 | 说明 |
|---|---|---|---|
| 1 | [`packages/types/src/global-settings.ts`](../packages/types/src/global-settings.ts) | 新增字段 | `modeLevelLlmRoutingEnabled` |
| 1 | `src/services/mode-routing/ModeRoutingTypes.ts` | 新建 | resolver 输入输出类型 |
| 1 | `src/services/mode-routing/ModeRoutingResolver.ts` | 新建 | 路由判定核心 |
| 1 | `src/services/mode-routing/index.ts` | 新建 | 导出 |
| 1 | `src/services/mode-routing/__tests__/ModeRoutingResolver.spec.ts` | 新建 | 单测 |
| 2 | [`src/core/webview/ClineProvider.ts`](../src/core/webview/ClineProvider.ts) | 改造 | `handleModeSwitch` / task 恢复走 resolver |
| 2 | [`src/core/task/Task.ts`](../src/core/task/Task.ts) | 改造 | `submitUserMessage` 切换前快照 |
| 2 | `src/core/webview/__tests__/ClineProvider.mode-routing.spec.ts` | 新建 | 行为测试 |
| 3 | [`packages/types/src/vscode-extension-host.ts`](../packages/types/src/vscode-extension-host.ts) | 扩展 | `WebviewMessage` 新增类型 + `ExtensionState` 新增字段 |
| 3 | [`src/core/webview/webviewMessageHandler.ts`](../src/core/webview/webviewMessageHandler.ts) | 新增 case | `setModeLevelLlmRoutingEnabled` |
| 3 | [`webview-ui/src/components/chat/ChatTextArea.tsx`](../webview-ui/src/components/chat/ChatTextArea.tsx) | 改造 | 锁图标改发新消息 |
| 3 | `webview-ui/src/components/settings/ModeRoutingSettings.tsx` | 新建 | 设置面板 |
| 3 | [`webview-ui/src/components/chat/TaskHeader.tsx`](../webview-ui/src/components/chat/TaskHeader.tsx) | 改造 | 当前 Mode·模型标签 |
| 4 | [`src/core/task/Task.ts`](../src/core/task/Task.ts) | 桩函数 | `maybeCreateModeHandoff` / `consumePendingModeHandoff` |
| 5 | [`packages/types/src/message.ts`](../packages/types/src/message.ts) | 扩展 | `modeAtRequest` / `providerProfileAtRequest` / `multiModelUsageSchema` |
| 5 | [`packages/core/src/message-utils/consolidateTokenUsage.ts`](../packages/core/src/message-utils/consolidateTokenUsage.ts) | 新增函数 | `consolidateMultiModelUsage` |
| 5 | [`src/core/task/Task.ts`](../src/core/task/Task.ts) | 改造 | `api_req_started` 写归因字段 |
| 5 | [`webview-ui/src/components/chat/TaskHeader.tsx`](../webview-ui/src/components/chat/TaskHeader.tsx) | 改造 | 双口径展示 |
| 5 | `webview-ui/src/components/chat/MultiModelUsageBreakdown.tsx` 等 | 新建 | breakdown 组件 |
| 6A | [`webview-ui/src/components/settings/SettingsView.tsx`](../webview-ui/src/components/settings/SettingsView.tsx) 等 | 隐藏入口 | orchestrator tab 标 legacy + 互斥提示 |
| 6B | [`src/core/task/OrchestratorEngine.ts`](../src/core/task/OrchestratorEngine.ts) 等 | **物理删除** | 详见 Phase 6B 删除清单（7 大类） |

---

## 4. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| `lockApiConfigAcrossModes` 与新开关双写期不一致 | 切换行为错乱 | Phase 3 消息处理中**双写**（新开关写 globalState，旧开关写反义到 workspaceState）；resolver 优先读新开关 |
| `handleModeSwitch` 的"无 saved config 时存当前 config 为 mode 默认"副作用 | routing disabled 下污染 `modeApiConfigs` | 改造时把该副作用包在 `routingEnabled === true` 分支内 |
| `modeApiConfigs` 存 configId 而非 profile name | resolver 越权访问 listConfig | resolver 只返回 configId + source；configId→name 解析留在 `ClineProvider` |
| 历史 task 的 `api_req_started` 无归因字段 | Phase 5 breakdown 缺数据 | 归入 `unknown` 桶，不回填；只对新请求生效 |
| profile 不存在（用户删除了绑定的 config） | 切 Mode 崩溃 | `activateProviderProfile` 前校验 profile 存在；不存在则保持当前 + 记日志 |
| Orchestrator 与新路由并存时语义冲突 | 两套机制打架 | Phase 6A 互斥：当 `orchestratorEnabled=true` 时**禁用** mode-level routing 的自动切换（让 orchestrator 自己管 stage 切换）；反之开启路由时拒绝开启 orchestrator |
| Phase 6B 物理删除后历史消息的 `orchestratorRole` 字段 | 旧 task 消息显示异常 | zod schema 字段为 `optional`，删除后 parse 丢弃该字段不报错；`ChatRow` 删除渲染分支后按普通消息显示 |
| Phase 6B 删除 `OrchestratorModeConfig` 后 Task 构造函数调用方报错 | 编译失败 | 删除前确认 [`webviewMessageHandler.ts:679`](../src/core/webview/webviewMessageHandler.ts) 等所有调用方不再传 `orchestratorMode` |
| Phase 6B 遗漏 i18n 键 | 运行时翻译缺失警告 | 删除后全局搜索 `orchestrator.` 翻译键，确保 `public/locales/` 下零残留 |

---

## 5. 测试计划

### 5.1 路由解析（Phase 1）
- routing disabled 总走全局
- routing enabled 走 `modeApiConfigs[mode]`
- `explicitProviderProfile` 优先级最高
- mode 未配置回退到 task/global
- `lockApiConfigAcrossModes` 反义映射
- 新开关 `undefined` 时回退到旧开关

### 5.2 Provider 行为（Phase 2）
- `setMode(code)` 切到 code 绑定模型
- `setMode(architect)` 切到 architect 绑定模型
- routing disabled 时 `setMode()` 不切 profile
- profile 不存在不崩溃
- **回归**：现有 `ClineProvider.lockApiConfig.spec.ts` / `sticky-profile.spec.ts` / `sticky-mode.spec.ts` 全绿

### 5.3 兼容（Phase 2-3）
- 旧 `lockApiConfigAcrossModes` 能正确映射
- 历史 task 恢复不被破坏
- global profile 仍可正常工作

### 5.4 多模型计价与空间（Phase 5）
- 累计费用 = 所有模型成本之和
- 累计 Token = 所有模型 token 之和
- 当前可用空间只按当前生效模型 context window
- breakdown 正确按 Mode / Profile 聚合
- 切换 Mode 后顶部当前模型标签正确变化

---

## 6. 验收标准

1. 有明确总开关控制"是否按 Mode 使用不同 LLM"
2. 开关关闭时，行为与当前全局模型方案基本一致（回归测试全绿）
3. 开关开启时，切换 Mode 自动切换到对应 Provider Profile
4. 不因切换 Mode 新建 task 或丢失上下文
5. 高价值任务可交给高级 LLM，简单任务交给便宜 LLM
6. Phase 4 预留的 handoff 桩函数存在且不报错
7. 用户可清楚区分"累计费用"与"当前模型上下文"两套口径
8. 用户可查看按 Mode / Profile 的成本分摊
9. 用户可直观看到哪种 Mode / 模型最消耗成本
10. Phase 6A 完成后：orchestrator 入口隐藏/标 legacy，与新路由互斥
11. Phase 6B 完成后：全局搜索 `orchestrator` 在 `src/` `packages/` `webview-ui/` 下零命中（除迁移代码和 CHANGELOG），`tsc` 编译通过，全量测试通过

---

## 7. 推荐执行顺序

```
Phase 1（底座，纯新增，零风险）
  ↓
Phase 2（接入，改 handleModeSwitch，中风险，靠回归测试兜底）
  ↓
Phase 3（UI，纯前端+消息处理，低风险）
  ↓
Phase 4（留桩，零风险）
  ↓
Phase 5（计价展示，独立大块，可与 1-4 并行起步）
  ↓
Phase 6A（orchestrator 退场，隐藏入口，低风险）
  ↓  ↓ 新方案稳定运行至少一个迭代周期后
Phase 6B（orchestrator 物理删除，中风险，靠全局搜索+tsc+测试兜底）
```

**最小可验证路径**：完成 Phase 1+2+3 后，即可让用户体验"切 Mode 自动换模型"，验证省 Token 效果。Phase 5 可独立排期。

**删除路径**：Phase 6A 与 Phase 1-5 可并行（只是隐藏入口）；Phase 6B 必须在 Phase 1-5 全部稳定后才执行，且执行后用 `全局搜索 orchestrator + tsc + 全量测试` 三重验证。
