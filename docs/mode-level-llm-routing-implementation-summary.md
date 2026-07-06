# Mode 级 LLM 路由实现总结

> 本文档记录 Mode 级 LLM 路由方案（废弃 Multi-Model Orchestration）的完整实现过程与最终代码状态。
> 对应设计文档：[`mode-level-llm-routing-migration-plan.md`](./mode-level-llm-routing-migration-plan.md)
> 对应落地方案：[`mode-level-llm-routing-implementation-guide.md`](./mode-level-llm-routing-implementation-guide.md)

---

## 1. 实现概览

本次实现完成了从 Multi-Model Orchestration（Planner/Worker/Reviewer 三阶段）到 **Mode 级 LLM 路由**的迁移主体，包括：

1. 新增 Mode 级 LLM 路由能力（开关 + 解析器 + UI）
2. 多模型计价与上下文展示升级（`MultiModelUsageBreakdown` 已接入 TaskHeader 展开态，用户可见）
3. Multi-Model Orchestration 的**物理删除**（代码、类型、UI、测试全部清除）

**未实现部分**（需后续推进）：
- Mode Handoff Summary（文档 2）：`captureModeSwitchSnapshot` 仍为桩函数，未生成 handoff 内容
- `ClineProvider.mode-routing.spec.ts` 行为测试：Mode 切换是否真按绑定 profile 走仍依赖人工验证

### 验证结果

| 验证项 | 结果 |
|---|---|
| src TypeScript 编译 | ✅ 通过 |
| webview-ui TypeScript 编译 | ✅ 通过 |
| ModeRoutingResolver 单测 | ✅ 27/27 全绿 |
| consolidateMultiModelUsage 单测 | ✅ 10/10 全绿 |
| MultiModelUsageBreakdown 单测 | ✅ 7/7 全绿 |
| TaskHeader.multi-model 单测 | ✅ 5/5 全绿 |
| 全局搜索 Multi-Model Orchestrator 残留 | ✅ 零残留 |
| vsix 构建 | ✅ `bin/vertex-3.56.0.vsix`（40.77 MB） |

---

## 2. 核心设计决策

### 2.1 开关语义反转

新增 `modeLevelLlmRoutingEnabled` 开关，与现有 `lockApiConfigAcrossModes` 互为反义：

```
modeLevelLlmRoutingEnabled = true   ⇔ lockApiConfigAcrossModes = false  （按 Mode 切换 profile）
modeLevelLlmRoutingEnabled = false  ⇔ lockApiConfigAcrossModes = true   （锁定全局 profile）
```

- 新开关优先；未设置时回退到旧开关反义
- 双写策略：UI 切换时同时写新开关（globalState）和旧开关反义（workspaceState）

### 2.2 路由判定收口到 resolver

不再让 `handleModeSwitch`、task 恢复、`submitUserMessage` 各自写判定逻辑，统一调 [`resolveRoutingEnabled()`](../src/services/mode-routing/ModeRoutingResolver.ts)。

### 2.3 计价与上下文展示拆成两套口径

- **累计口径**（全 task、所有模型）：费用、Token 总量
- **当前口径**（当前生效模型）：contextWindow、已用、可用

---

## 3. 分阶段实现记录

### Phase 1：配置与路由底座

**新增文件**：
- [`src/services/mode-routing/ModeRoutingTypes.ts`](../src/services/mode-routing/ModeRoutingTypes.ts) — 输入输出类型（`ResolveModeProfileInput` / `ResolveModeProfileOutput`）
- [`src/services/mode-routing/ModeRoutingResolver.ts`](../src/services/mode-routing/ModeRoutingResolver.ts) — 路由解析核心（`resolveProfileForMode` / `resolveRoutingEnabled` / `shouldAutoSwitchProfile`）
- [`src/services/mode-routing/index.ts`](../src/services/mode-routing/index.ts) — 统一导出
- [`src/services/mode-routing/__tests__/ModeRoutingResolver.spec.ts`](../src/services/mode-routing/__tests__/ModeRoutingResolver.spec.ts) — 27 个单测

**修改文件**：
- [`packages/types/src/global-settings.ts`](../packages/types/src/global-settings.ts) — 新增 `modeLevelLlmRoutingEnabled` 字段

**路由优先级**：
```
routing enabled:  explicit > mode-binding > task > global
routing disabled: explicit > task > global（不应用 modeApiConfigs）
```

### Phase 2：Provider 接入

**修改文件**：
- [`src/core/webview/ClineProvider.ts`](../src/core/webview/ClineProvider.ts) — `handleModeSwitch` 和 task 恢复路径改用 `resolveRoutingEnabled()`
- [`src/core/task/Task.ts`](../src/core/task/Task.ts) — `submitUserMessage` 新增 `captureModeSwitchSnapshot()` 切换前快照

### Phase 3：UI 与设置接入

**修改文件**：
- [`packages/types/src/vscode-extension-host.ts`](../packages/types/src/vscode-extension-host.ts) — `WebviewMessage` 新增 `setModeLevelLlmRoutingEnabled`；`ExtensionState` 新增 `modeLevelLlmRoutingEnabled`
- [`src/core/webview/webviewMessageHandler.ts`](../src/core/webview/webviewMessageHandler.ts) — 新增 `setModeLevelLlmRoutingEnabled` case（双写）
- [`src/core/webview/ClineProvider.ts`](../src/core/webview/ClineProvider.ts) — getState 两处输出新字段
- [`webview-ui/src/components/chat/ChatTextArea.tsx`](../webview-ui/src/components/chat/ChatTextArea.tsx) — 锁图标改发 `setModeLevelLlmRoutingEnabled`（语义反转）

### Phase 4：预留 Handoff 桩（未实现 handoff 逻辑）

- [`src/core/task/Task.ts`](../src/core/task/Task.ts) — `captureModeSwitchSnapshot()` **桩函数**已就位，但**未实现** handoff 生成与注入逻辑。文档 2（mode-handoff-summary）实现时需要：
  1. 在 `captureModeSwitchSnapshot` 中生成 `ModeHandoffSummary`
  2. 在 `recursivelyMakeClineRequests` 发起 API 请求前注入 handoff context
  3. 新增 `mode_handoff` 消息类型与 UI 渲染

### Phase 5：计价与上下文展示升级

**新增文件**：
- [`webview-ui/src/components/chat/MultiModelUsageBreakdown.tsx`](../webview-ui/src/components/chat/MultiModelUsageBreakdown.tsx) — 按 Mode/Profile 的成本分摊面板（含 Top Cost 指标）
- [`packages/core/src/message-utils/__tests__/consolidateMultiModelUsage.spec.ts`](../packages/core/src/message-utils/__tests__/consolidateMultiModelUsage.spec.ts) — 10 个单测
- [`webview-ui/src/components/chat/__tests__/MultiModelUsageBreakdown.spec.tsx`](../webview-ui/src/components/chat/__tests__/MultiModelUsageBreakdown.spec.tsx) — 7 个单测
- [`webview-ui/src/components/chat/__tests__/TaskHeader.multi-model.spec.tsx`](../webview-ui/src/components/chat/__tests__/TaskHeader.multi-model.spec.tsx) — 5 个单测
- [`src/shared/getMultiModelUsage.ts`](../src/shared/getMultiModelUsage.ts) — webview-ui 用的 re-export 包装

**修改文件**：
- [`packages/types/src/message.ts`](../packages/types/src/message.ts) — 新增 `modeAtRequest` / `providerProfileAtRequest` 归因字段 + `usageBreakdownItemSchema` / `multiModelUsageSchema`
- [`packages/core/src/message-utils/consolidateTokenUsage.ts`](../packages/core/src/message-utils/consolidateTokenUsage.ts) — 新增 `consolidateMultiModelUsage()` 函数
- [`packages/core/src/message-utils/index.ts`](../packages/core/src/message-utils/index.ts) — 导出新函数
- [`src/core/task/Task.ts`](../src/core/task/Task.ts) — `say()` 方法在 `api_req_started` 时自动写入归因字段
- [`webview-ui/src/components/chat/TaskHeader.tsx`](../webview-ui/src/components/chat/TaskHeader.tsx) — 收起态增加当前 Mode·模型标签；展开态渲染 `MultiModelUsageBreakdown`（当 `byMode` 有数据时）
- [`webview-ui/src/components/chat/ChatView.tsx`](../webview-ui/src/components/chat/ChatView.tsx) — 调用 `getMultiModelUsage(modifiedMessages)` 生成 `multiModelUsage` 并传给 `TaskHeader`

### Phase 6A：Orchestrator 退场

- [`webview-ui/src/components/settings/SettingsView.tsx`](../webview-ui/src/components/settings/SettingsView.tsx) — orchestrator tab 标 legacy
- [`webview-ui/src/components/chat/OrchestratorDropdown.tsx`](../webview-ui/src/components/chat/OrchestratorDropdown.tsx) — 路由开启时不渲染（Phase 6B 已删除该文件）
- [`src/core/webview/webviewMessageHandler.ts`](../src/core/webview/webviewMessageHandler.ts) — 互斥提示（Phase 6B 已删除该 case）

### Phase 6B：Orchestrator 物理删除

**删除的文件/目录**：
- `packages/types/src/orchestrator.ts`
- `packages/types/src/orchestrator-events.ts`
- `packages/types/src/orchestrator-config.ts`
- `src/core/task/OrchestratorEngine.ts`
- `webview-ui/src/components/chat/OrchestratorDropdown.tsx`
- `webview-ui/src/components/orchestrator/`（整目录：OrchestratorSettings / OrchestratorSessionPanel / OrchestratorToggle）

**清理的引用（30+ 处）**：

| 层 | 文件 | 清理内容 |
|---|---|---|
| 类型层 | [`index.ts`](../packages/types/src/index.ts) | 删除 3 个 orchestrator 导出 |
| 类型层 | [`global-settings.ts`](../packages/types/src/global-settings.ts) | 删除 orchestratorEnabled/Config/Session |
| 类型层 | [`message.ts`](../packages/types/src/message.ts) | 删除 orchestratorRole/orchestratorModelId |
| 类型层 | [`vscode-extension-host.ts`](../packages/types/src/vscode-extension-host.ts) | 删除 ExtensionState 字段 + OrchestratorStageInfo/SessionSnapshot 类型 + WebviewMessage 消息类型 + sessionId |
| 类型层 | [`task.ts`](../packages/types/src/task.ts) | 删除 OrchestratorModeConfig/State/StageConfig + TaskOptions.orchestratorMode |
| 核心层 | [`Task.ts`](../src/core/task/Task.ts) | 删除 import + 字段 + 构造分支 + initiateTaskLoop 分支 + getCurrentOrchestratorMessageMeta + orchestratorState getter + approveOrchestratorPlan + cancelOrchestrator + sayWithOrchestratorMeta |
| 核心层 | [`ClineProvider.ts`](../src/core/webview/ClineProvider.ts) | 删除 orchestratorSession 快照构建 + state 输出 |
| 核心层 | [`webviewMessageHandler.ts`](../src/core/webview/webviewMessageHandler.ts) | 删除 orchestratorEnabled 判定 + config 组装 + 4 个 case |
| UI 层 | [`ChatRow.tsx`](../webview-ui/src/components/chat/ChatRow.tsx) | 删除 role 渲染分支 |
| UI 层 | [`ChatTextArea.tsx`](../webview-ui/src/components/chat/ChatTextArea.tsx) | 删除 OrchestratorDropdown import + orchestratorEnabled |
| UI 层 | [`ChatView.tsx`](../webview-ui/src/components/chat/ChatView.tsx) | 删除 OrchestratorSessionPanel |
| UI 层 | [`SettingsView.tsx`](../webview-ui/src/components/settings/SettingsView.tsx) | 删除 OrchestratorSettings + tab + section + sync |
| UI 层 | [`ExtensionStateContext.tsx`](../webview-ui/src/context/ExtensionStateContext.tsx) | 删除类型 + state + setter |
| 测试层 | [`ExtensionStateContext.spec.tsx`](../webview-ui/src/context/__tests__/ExtensionStateContext.spec.tsx) | 删除 orchestratorSession 测试用例 |

---

## 4. 最终代码结构

### 新增的 Mode 级路由服务

```text
src/services/mode-routing/
├── ModeRoutingTypes.ts          # 输入输出类型
├── ModeRoutingResolver.ts       # 路由解析核心（纯函数）
├── index.ts                     # 统一导出
└── __tests__/
    └── ModeRoutingResolver.spec.ts  # 27 个单测
```

### 新增的多模型计价结构

```text
packages/types/src/message.ts
├── modeAtRequest                # ClineMessage 归因字段：请求时的 Mode
├── providerProfileAtRequest     # ClineMessage 归因字段：请求时的 Profile
├── usageBreakdownItemSchema     # 单项分摊结构
└── multiModelUsageSchema        # 多模型聚合结构（total + byMode + byProfile + currentEffective*）

packages/core/src/message-utils/consolidateTokenUsage.ts
└── consolidateMultiModelUsage() # 聚合函数（10 个单测）
```

### 新增的 UI 组件

```text
webview-ui/src/components/chat/
├── MultiModelUsageBreakdown.tsx  # 成本分摊面板（By Mode / By Profile / Top Cost）
└── TaskHeader.tsx                # 增加"当前 Mode·模型"标签
```

---

## 5. 使用方式

### 5.1 开启 Mode 级路由

点击聊天输入框的锁图标（解锁状态 = 按 Mode 路由），或通过设置页。

开启后：
- 切到 `Code` → 自动用 Code 绑定的 Profile
- 切到 `Architect` → 自动用 Architect 绑定的 Profile
- 切到 `Ask` → 自动用 Ask 绑定的 Profile

### 5.2 配置 Mode → Profile 绑定

通过现有的 Mode 配置区域（`modeApiConfigs`），为每个 Mode 选择对应的 Provider Profile。

### 5.3 查看多模型成本

TaskHeader 顶部显示：
- 当前模型上下文占比（当前模型口径）
- 任务累计费用（全 task 口径）
- 当前 Mode·模型标签

展开后（点击 TaskHeader 展开）可看到 `MultiModelUsageBreakdown` 面板，展示 By Mode / By Profile 的成本分摊（当 `byMode` 有数据时才渲染）。

---

## 6. 兼容策略

| 场景 | 行为 |
|---|---|
| 老用户（`modeLevelLlmRoutingEnabled` 未设置） | 回退到 `lockApiConfigAcrossModes` 反义，行为不变 |
| `lockApiConfigAcrossModes = true` | 等价于 routing disabled（锁定全局） |
| `lockApiConfigAcrossModes = false`（默认） | 等价于 routing enabled（按 Mode 切换） |
| 历史 task 的 `orchestratorRole` 字段 | schema 字段已删除，zod parse 丢弃不报错，按普通消息显示 |
| 历史 task 的 `api_req_started` 无归因字段 | breakdown 时归入 "unknown" 桶，不回填 |

---

## 7. 后续工作

### 7.1 Mode Handoff Summary（文档 2）

[`captureModeSwitchSnapshot()`](../src/core/task/Task.ts) 桩函数已就位。实现 [`mode-handoff-summary-implementation-plan.md`](./mode-handoff-summary-implementation-plan.md) 时：
1. 在 `captureModeSwitchSnapshot` 中生成 `ModeHandoffSummary`
2. 在 `recursivelyMakeClineRequests` 发起 API 请求前注入 handoff context

### 7.2 i18n 清理

`orchestrator.*` 翻译键（如 `chat:orchestrator.tooltip`）可进一步清理，当前不影响功能。

### 7.3 设置页 Mode-Level Routing 独立面板

当前通过锁图标切换，可考虑在 Settings 新增独立的 `ModeRoutingSettings.tsx` 面板，提供更清晰的说明文案和每个 Mode 的 Profile 下拉。
