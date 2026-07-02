# 废弃 Multi-Model Orchestration，迁移到 Mode 级 LLM 路由方案（最终版）

## 1. 背景

当前工程里已经同时存在两条“多模型”路径：

1. `Multi-Model Orchestration`
   - Planner / Worker / Reviewer 三阶段切换
   - 本质是 Task 内部的 Mode Chain
2. `Mode -> Profile` 绑定基础能力
   - 已有 `modeApiConfigs`
   - 已有 `setMode()` 与 `setProviderProfile()`
   - 已有 task 级 `mode + apiConfigName` 持久化

从当前产品目标来看，你真正需要的不是一个额外的编排器系统，而是：

- `Code` 用便宜但强执行的模型
- `Architect` 用更强推理模型
- `Ask` 用低成本通用问答模型
- `Graphics` 用图形分析专项模型

并且在这些 Mode 之间切换时：

- 不丢上下文
- 不新建会话
- 自动接住当前任务
- 让高价值任务才消耗高价模型的 Token

所以更合适的主方案应该是：

**废弃 Multi-Model Orchestration 作为主路径，改为 Mode 级 LLM 路由。**

---

## 2. 目标

## 2.1 核心目标

把“不同模型做不同事情”的能力，从 Orchestrator 三阶段配置，迁移为：

**每个 Mode 可单独绑定一个 Provider Profile / LLM。**

## 2.2 开关要求

必须增加一个全局开关：

- 开启时：不同 Mode 自动使用各自绑定的 LLM
- 关闭时：所有 Mode 继续使用原本的全局 LLM

也就是：

**这是一个可切换的“省 Token 路由模式”，不是强制替代当前全局模型机制。**

## 2.3 产品目标

这项能力的产品价值非常明确：

- 把高价值、高推理需求的任务交给高级模型
- 把简单、重复、低风险的任务交给便宜模型
- 在不破坏当前交互方式的前提下，降低整体 Token 成本

---

## 3. 为什么要放弃 Multi-Model Orchestration

## 3.1 它不是你未来产品的主心智模型

你未来的产品主轴是：

- Code
- Architect
- Ask
- Graphics
- Perf / Debug / GPU

用户理解的是“我现在处在哪个 Mode”，而不是“Planner / Worker / Reviewer 正在哪个阶段”。

所以真正自然的产品心智是：

**Mode 决定工作语义，Mode 也顺带决定用哪个模型。**

## 3.2 当前 Orchestrator 的成本高于价值

当前 Multi-Model Orchestration 已有三阶段骨架，但有几个问题：

- 它引入了额外配置复杂度
- 它不是所有任务都需要
- 很多路由字段目前只是“配置存在”，并未真正实现调度
- 它和未来 `Graphics Mode` 的自然交互不完全一致

尤其是这些字段当前并没有形成真正成熟的调度系统：

- `workerProfiles.fallback`
- `routingPolicy.highRiskToPlanner`
- `routingPolicy.budgetPressure`

也就是说，它现在更像一个“阶段式实验能力”，而不是未来应该持续扩展的产品主干。

## 3.3 当前代码已经更适合走 Mode 级路由

现有代码基础里已经有：

- [`packages/types/src/global-settings.ts`](H:/Project/AgentProject/packages/types/src/global-settings.ts) 中的 `modeApiConfigs`
- [`src/core/webview/ClineProvider.ts`](H:/Project/AgentProject/src/core/webview/ClineProvider.ts) 中的 `getModeConfigId()` / `activateProviderProfile()`
- `lockApiConfigAcrossModes`
- [`src/core/task/Task.ts`](H:/Project/AgentProject/src/core/task/Task.ts) 中的 `submitUserMessage(text, images, mode, providerProfile)`

这说明工程本身已经天然支持“Mode 绑定 Profile”这条主路。

---

## 4. 最终产品方案

## 4.1 方案一句话

引入一个全局开关：

- `modeLevelLlmRoutingEnabled = true`

开启后：

- 切换到某个 Mode 时，自动切换到该 Mode 绑定的 Provider Profile

关闭后：

- 所有 Mode 都继续使用当前全局 Profile

## 4.2 用户视角行为

### 开关关闭

行为与现在尽量一致：

- 用户切 `Code / Architect / Ask / Graphics`
- 只切换 prompt / tools / 行为语义
- 模型仍然用当前全局 LLM

### 开关开启

行为变成：

- 用户切到 `Code` -> 自动用 `Code` 对应的 Profile
- 用户切到 `Architect` -> 自动用 `Architect` 对应的 Profile
- 用户切到 `Ask` -> 自动用 `Ask` 对应的 Profile
- 用户切到 `Graphics` -> 自动用 `Graphics` 对应的 Profile

### 任务连续性

无论开关开还是关，都必须保持：

- 同一个 task
- 同一个历史上下文
- 不新建会话
- 不断开记忆链

这部分由之前设计的 `mode handoff summary` 负责补强。

---

## 5. 配置模型设计

## 5.1 复用 `modeApiConfigs`

当前已经有：

```ts
modeApiConfigs: Record<string, string>
```

它本质上就是：

```ts
{
  code: "qwen-code",
  architect: "gpt-5.5",
  ask: "sonnet-4.7",
  graphics: "graphics-pro"
}
```

因此，不需要重新发明一套 `modeProfiles` 配置。

建议直接复用：

- `modeApiConfigs` 作为 Mode -> Profile 的绑定表

## 5.2 新增全局开关

建议在 [`packages/types/src/global-settings.ts`](H:/Project/AgentProject/packages/types/src/global-settings.ts) 中新增：

```ts
modeLevelLlmRoutingEnabled: z.boolean().optional()
```

推荐默认值：

```ts
false
```

理由：

- 向后兼容
- 默认仍沿用全局模型行为
- 用户可逐步开启

## 5.3 与 `lockApiConfigAcrossModes` 的关系

当前已有：

- `lockApiConfigAcrossModes`

但这个概念和新方案会有语义冲突。

建议未来收敛为：

- `modeLevelLlmRoutingEnabled = false`
  - 等价于“锁定全局 LLM，不随 Mode 切换”
- `modeLevelLlmRoutingEnabled = true`
  - 等价于“允许 Mode 驱动 LLM 切换”

也就是说，长期建议：

**用 `modeLevelLlmRoutingEnabled` 取代 `lockApiConfigAcrossModes` 作为更清晰的产品表达。**

短期兼容策略见后文。

---

## 6. 模型路由规则

## 6.1 路由优先级

建议最终优先级如下：

### 当 `modeLevelLlmRoutingEnabled = false`

1. 当前 task 自己持有的 `apiConfigName`
2. 当前全局 `currentApiConfigName`

不应用 `modeApiConfigs`。

### 当 `modeLevelLlmRoutingEnabled = true`

1. 用户本次显式指定的 `providerProfile`
2. 当前 Mode 在 `modeApiConfigs` 中绑定的 Profile
3. 当前 task 自己持有的 `apiConfigName`
4. 当前全局 `currentApiConfigName`

这样可以保证：

- Mode 有默认模型
- 用户仍可临时覆盖
- task 历史仍然可恢复

## 6.2 建议默认映射

举例：

- `Code -> qwen3.7`
- `Architect -> GPT5.5`
- `Ask -> Sonnet 4.7`
- `Graphics -> 图形专项模型`

这正符合你的成本目标：

- 规划、审查、复杂分析给强模型
- 写代码、改样板、低风险工作给便宜模型
- 常规问答尽量走中低成本模型

---

## 7. 与 Mode Handoff Summary 的关系

这套方案必须和之前的文档联动：

- [mode-handoff-summary-implementation-plan.md](H:/Project/AgentProject/docs/mode-handoff-summary-implementation-plan.md)

原因很简单：

当 `Code=qwen`、`Architect=GPT`、`Ask=Sonnet` 时，
真正的问题不再是“能不能切换”，而是“切换后能不能稳地接住上下文”。

所以建议两项能力联动上线：

1. Mode 级 LLM 路由
2. Mode 切换交接摘要

这两者合在一起，才是完整的“省 Token 多模型工作流”。

---

## 8. 目录结构建议

建议新增或调整：

```text
packages/
  types/
    src/
      global-settings.ts

src/
  services/
    mode-routing/
      ModeRoutingTypes.ts
      ModeRoutingResolver.ts
      ModeRoutingService.ts
  core/
    webview/
      ClineProvider.ts
      webviewMessageHandler.ts
  core/
    config/
      ProviderSettingsManager.ts

webview-ui/
  src/
    components/
      settings/
      modes/
```

---

## 9. 具体代码落点

## 9.1 `packages/types/src/global-settings.ts`

新增：

```ts
modeLevelLlmRoutingEnabled: z.boolean().optional()
```

同时建议在注释中写清楚：

- `false` 时使用全局模型
- `true` 时按 Mode 自动切换到对应 Profile

## 9.2 `src/services/mode-routing/ModeRoutingResolver.ts`

新增一个统一解析器，不要把逻辑散落在 `Task`、`Provider`、`webview handler` 多处。

建议接口：

```ts
export interface ResolveModeProfileInput {
  mode: string
  explicitProviderProfile?: string
  currentTaskApiConfigName?: string
  currentGlobalApiConfigName?: string
  modeApiConfigs?: Record<string, string>
  modeLevelLlmRoutingEnabled?: boolean
}

export function resolveProfileForMode(input: ResolveModeProfileInput): string | undefined
```

职责：

- 统一实现优先级规则
- 让所有 Mode 切换都走同一套判定

## 9.3 `src/core/webview/ClineProvider.ts`

这里是主要接入点。

当前 `setMode(newMode)` 已经会处理 mode 切换与 mode-specific config。

建议改造为：

1. 读取 `modeLevelLlmRoutingEnabled`
2. 如果关闭：
   - 不根据 `modeApiConfigs` 自动切 Profile
3. 如果开启：
   - 根据 `modeApiConfigs[newMode]` 自动激活目标 Profile

同时要保留：

- task 恢复逻辑
- profile 不存在时的降级策略
- UI 状态同步

## 9.4 `src/core/webview/webviewMessageHandler.ts`

需要新增两类消息处理：

1. 更新开关

```ts
case "setModeLevelLlmRoutingEnabled"
```

2. 更新某个 Mode 的绑定 Profile

如果现有 UI 已经通过通用配置面板写 `modeApiConfigs`，则可直接复用；
否则补一个明确消息：

```ts
case "updateModeApiConfig"
```

## 9.5 `src/core/config/ProviderSettingsManager.ts`

这里已经管理 `modeApiConfigs`。

建议补充：

- 读取 mode 的 profile 绑定
- 写入 mode 的 profile 绑定
- 当 mode 新增或删除时做兼容清洗

如果已有相关方法，就只补最小改造，不要重做整个 manager。

## 9.6 `src/core/task/Task.ts`

这里不应该再承担“决定某个 mode 用哪个模型”的路由逻辑。

`Task` 更适合只做：

- 继续支持 `submitUserMessage(..., mode, providerProfile)`
- 接入 handoff summary
- 保存 task 级 `apiConfigName`

也就是说：

**Mode 选模逻辑放在 Provider / Routing Service，Task 不做产品规则判断。**

---

## 10. UI 设计建议

## 10.1 设置区新增总开关

建议在 Settings 中增加：

- `Enable Mode-Level LLM Routing`

说明文案建议类似：

`When enabled, each Mode can use its own LLM profile. When disabled, all Modes use the global LLM profile.`

## 10.2 每个 Mode 配置自己的 LLM

在 Mode 配置区域，给每个 Mode 增加：

- `Provider Profile`

例如：

- Code
  - Profile: `qwen3.7`
- Architect
  - Profile: `gpt5.5`
- Ask
  - Profile: `sonnet-4.7`
- Graphics
  - Profile: `graphics-expert`

## 10.3 UI 状态表达

建议在顶部或当前 Mode 区域提示：

- 当前 Mode
- 当前实际生效模型
- 是否处于 Mode-Level Routing 状态

避免用户误以为自己还在用全局模型。

---

## 10.4 多模型下的计价、Token 与上下文空间显示

当 `modeLevelLlmRoutingEnabled = true` 后，UI 里必须把下面三件事分开：

1. 任务累计成本
2. 任务累计 Token 消耗
3. 当前模型的上下文空间

这是因为多模型场景下：

- 成本与总 Token 是“全 task 累计口径”
- 可用空间是“当前生效模型口径”

它们不能再共用同一个展示语义。

### 推荐原则

建议采用：

- `账单看累计`
- `空间看当前`

也就是：

- `总费用 / 总 Token`
  - 统计整个 task 到当前为止，所有模型的累计值
- `已使用 Token / 为回复保留 / 可用空间`
  - 只按“当前即将发请求的那个模型”的 context window 来算

### 为什么这样最合理

用户真正关心的是两件事：

1. 这个任务总共花了多少钱
2. 我下一轮还能塞进去多少上下文

这两件事本来就不是同一个口径。

如果把多模型的 context window 做成：

- 取最小值
- 取平均值
- 或整个 task 的历史统一口径

都会误导用户。

### 当前工程的现状

当前工程已经天然分成两条计算链：

- 总 Token / 总费用
  - 来自 [`packages/core/src/message-utils/consolidateTokenUsage.ts`](H:/Project/AgentProject/packages/core/src/message-utils/consolidateTokenUsage.ts)
- 上下文空间显示
  - 来自 [`webview-ui/src/components/chat/TaskHeader.tsx`](H:/Project/AgentProject/webview-ui/src/components/chat/TaskHeader.tsx)

所以在多模型下，不需要推翻重做，只需要把“显示语义”定义清楚，并增加 breakdown。

---

## 10.5 推荐展示方案

### 收起态

保留当前顶部简洁显示，但语义改清楚：

- `24%`
  - 当前模型上下文占用百分比
- `$8.80`
  - 当前 task 累计费用
- `Architect · GPT-5.5`
  - 当前生效的 Mode 与模型

### 展开态

建议显示三组信息：

1. 当前模型上下文
   - 已使用 Token
   - 为回复保留
   - 可用空间
   - 当前 context window
2. 任务累计统计
   - 累计输入 Token
   - 累计输出 Token
   - 累计费用
3. 成本分摊
   - 按 Mode 分摊
   - 按 Profile / Model 分摊

### 明细层建议

建议至少支持两种 breakdown：

- `By Mode`
  - Code
  - Architect
  - Ask
  - Graphics
- `By Profile`
  - qwen3.7
  - GPT-5.5
  - Sonnet 4.7
  - 其他模型

每项建议显示：

- request count
- tokens in
- tokens out
- total cost

### 推荐补充指标

为了突出“省 Token”的价值，建议增加：

- `Top Cost Mode`
- `Top Cost Profile`

例如：

- `Top cost mode: Architect · $5.21`
- `Top cost profile: GPT-5.5 · 81.3k tokens`

这会让用户更容易理解：

- 为什么开启多模型
- 哪个 Mode 最贵
- 哪种任务最值得继续优化

---

## 10.6 口径定义

### A. 累计费用

定义：

- 当前 task 中，所有已完成 API 请求与 context condense 成本的累计和

口径：

- 全 task
- 所有 Mode
- 所有 Profile

### B. 累计 Token

定义：

- 当前 task 中，所有模型的 `tokensIn + tokensOut` 累计值

口径：

- 全 task
- 所有 Mode
- 所有 Profile

### C. 当前上下文已使用

定义：

- 当前即将使用的模型，在下一次请求前要携带的上下文 token 数量

口径：

- 当前生效模型
- 当前 context window

### D. 为回复保留

定义：

- 当前模型预留给本轮输出的 token 空间

口径：

- 当前生效模型

### E. 可用空间

定义：

- `currentContextWindow - contextTokens - reservedForOutput`

口径：

- 当前生效模型

### 关键原则

不要把：

- “累计费用”
- “累计 Token”
- “当前模型空间占比”

混成一个指标。

---

## 10.7 数据结构建议

当前 `TokenUsage` 只适合总量展示：

```ts
type TokenUsage = {
  totalTokensIn: number
  totalTokensOut: number
  totalCacheWrites?: number
  totalCacheReads?: number
  totalCost: number
  contextTokens: number
}
```

建议新增一个多模型聚合结构：

```ts
type UsageBreakdownItem = {
  mode?: string
  profile?: string
  modelId?: string
  requestCount: number
  tokensIn: number
  tokensOut: number
  totalCost: number
}

type MultiModelUsage = {
  total: TokenUsage
  byMode: UsageBreakdownItem[]
  byProfile: UsageBreakdownItem[]
  currentEffectiveMode?: string
  currentEffectiveProfile?: string
  currentEffectiveModelId?: string
  currentContextWindow?: number
  reservedForOutput?: number
  availableSpace?: number
}
```

### 为什么要加这个结构

因为 `TokenUsage` 现在只有“总账”，没有“归因”。

而你这个功能的核心价值恰恰是：

- 哪个 Mode 在烧钱
- 哪个模型最贵
- 成本是否真的被优化了

所以多模型一旦开启，就必须有 breakdown。

---

## 10.8 具体实现落点

### `packages/types/src/message.ts`

建议为 `api_req_started` 对应消息补充更稳定的归因字段：

- `mode`
- `providerProfile`
- `modelId`

当前已有：

- `modelId`
- `orchestratorModelId`

但对新的 Mode-Level LLM Routing 来说，还需要明确记录：

- 这次请求是在哪个 Mode 下发生的
- 这次请求用的是哪个 Profile

### `packages/core/src/message-utils/consolidateTokenUsage.ts`

当前这里只做总量汇总。

建议：

1. 保留现有 `consolidateTokenUsage()`
2. 新增：

```ts
consolidateMultiModelUsage(messages: ClineMessage[]): MultiModelUsage
```

职责：

- 统计 total
- 聚合 byMode
- 聚合 byProfile
- 识别 currentEffectiveMode / Profile / Model

### `src/core/task/Task.ts`

这里建议继续负责：

- 在 API 请求消息里写入 mode / profile / modelId 元信息

但不负责做 UI 聚合。

### `webview-ui/src/components/chat/TaskHeader.tsx`

当前这里直接按：

- `contextWindow`
- `contextTokens`
- `reservedForOutput`

算百分比和 available space。

建议改为：

1. 顶部继续显示“当前模型上下文占比”
2. 费用改为“任务累计费用”
3. 增加当前模型标签
4. tooltip 中把口径写清楚

### `webview-ui/src/components/chat/`

建议新增：

- `MultiModelUsageBreakdown.tsx`
- `ModeCostBreakdown.tsx`
- `ProfileCostBreakdown.tsx`

用于展开后的细分统计展示。

---

## 11. 与 Orchestrator 的关系

## 11.1 产品策略

建议将 Multi-Model Orchestration 降级为：

- `legacy`
- `experimental`
- 不再作为主能力扩展

## 11.2 技术策略

短期不建议立刻物理删除全部 orchestrator 代码。

建议分两步：

### Phase A

- 停止继续扩展 orchestrator
- 隐藏或弱化入口
- 产品主路径切换到 Mode-Level LLM Routing

### Phase B

- 新方案稳定后，逐步清理：
  - `orchestratorEnabled`
  - `orchestratorConfig`
  - `orchestratorSession`
  - `OrchestratorEngine`
  - 相关 UI 面板

## 11.3 为什么不建议立即硬删

因为当前代码里它已经接入：

- `Task`
- `ClineProvider`
- `webviewMessageHandler`
- `ExtensionStateContext`
- Settings UI

直接硬删改动面过大，风险高。

更好的方式是：

**先让它退出主舞台，再慢慢拆。**

---

## 12. 兼容策略

## 12.1 与现有全局模型兼容

默认：

- `modeLevelLlmRoutingEnabled = false`

这样老用户不会被突然改行为。

## 12.2 与 `lockApiConfigAcrossModes` 兼容

建议过渡期规则：

1. 如果新开关存在，优先用 `modeLevelLlmRoutingEnabled`
2. 如果新开关不存在，则回退到旧语义推导

推荐映射：

- `lockApiConfigAcrossModes = true`
  - 等价于 `modeLevelLlmRoutingEnabled = false`
- `lockApiConfigAcrossModes = false`
  - 等价于 `modeLevelLlmRoutingEnabled = true`

后续可以加一次性迁移，把旧字段自动转换。

## 12.3 与 task 历史兼容

task 历史里当前已经有：

- `mode`
- `apiConfigName`

所以历史任务恢复不需要大改。

只要保证：

- 恢复 task 时优先恢复任务自己的 `apiConfigName`
- 在用户下一次主动切 Mode 后，再应用新的 Mode-Level 路由规则

这样兼容最稳。

---

## 13. 开发任务清单

## 13.1 Phase 1：配置与路由底座

目标：

- 建立统一的 Mode 选模逻辑

任务：

1. 在 `global-settings.ts` 新增 `modeLevelLlmRoutingEnabled`
2. 新增 `ModeRoutingResolver`
3. 把 Mode -> Profile 解析统一收口到 resolver
4. 补基础单测

完成标准：

- 可以根据开关返回“全局模型”或“Mode 绑定模型”

## 13.2 Phase 2：Provider 接入

目标：

- 切 Mode 时真正自动换模型

任务：

1. 改造 `ClineProvider.setMode(...)`
2. 在 routing enabled 时自动按 `modeApiConfigs` 激活 profile
3. 在 routing disabled 时保持全局 profile
4. 处理不存在 profile 的降级逻辑

完成标准：

- 同一 task 切 Mode 时模型可正确切换

## 13.3 Phase 3：UI 与设置接入

目标：

- 用户可以管理开关和 Mode 对应模型

任务：

1. 增加 Mode-Level Routing 开关
2. 在 Mode 配置区域增加 Profile 绑定
3. 显示当前 Mode 的实际生效模型
4. 补 UI 状态同步与测试

完成标准：

- 用户能看懂、能配置、能验证当前是否走分 Mode 模型

## 13.4 Phase 4：接入 Handoff Summary

目标：

- 提升多模型 Mode 切换稳定性

任务：

1. 接入 `mode-handoff-summary-implementation-plan.md`
2. 在 Mode 切换时生成 handoff
3. 下一轮模型请求前自动注入 handoff

完成标准：

- `Code -> Architect -> Ask -> Graphics` 切换时连续性明显更稳

## 13.5 Phase 5：计价与上下文展示升级

目标：

- 让多模型成本与空间展示对用户可解释、可追踪

任务：

1. 为 API 请求消息补充 mode / profile / model 元信息
2. 新增 `MultiModelUsage` 聚合结构
3. 新增 `consolidateMultiModelUsage(...)`
4. 顶部展示改为“累计费用 + 当前模型上下文”
5. 增加按 Mode / Profile 的 breakdown 面板
6. 增加 Top cost mode / profile 指标

完成标准：

- 用户能清楚区分“累计成本”和“当前模型空间”
- 用户能看出哪个 Mode / 模型最烧钱
- 用户能验证多模型路由是否真的节省了 Token 成本

## 13.6 Phase 6：Orchestrator 退场

目标：

- 让旧编排器退出主流程

任务：

1. 设置页弱化 orchestrator 入口
2. 标记为 legacy / experimental
3. 停止继续给 orchestrator 增加新能力
4. 评估后续删除路径

完成标准：

- 用户默认只看到新的 Mode-Level LLM Routing 路径

---

## 14. 测试建议

建议至少补这些测试：

## 14.1 路由解析测试

- routing disabled 时总是走全局 profile
- routing enabled 时按 modeApiConfigs 走
- 显式指定 providerProfile 时优先级最高
- mode 未配置时回退到 task/global profile

建议位置：

- `src/services/mode-routing/__tests__/ModeRoutingResolver.spec.ts`

## 14.2 Provider 行为测试

- `setMode(code)` 时切到 `code` 绑定模型
- `setMode(architect)` 时切到 `architect` 绑定模型
- routing disabled 时 `setMode()` 不切 profile
- profile 不存在时不会崩溃

建议位置：

- `src/core/webview/__tests__/ClineProvider.mode-routing.spec.ts`

## 14.3 兼容测试

- 旧的 `lockApiConfigAcrossModes` 能正确映射
- 历史 task 恢复不被破坏
- global profile 仍可正常工作

建议位置：

- `src/core/webview/__tests__/ClineProvider.lockApiConfig.spec.ts`
- `src/core/webview/__tests__/ClineProvider.sticky-profile.spec.ts`

## 14.4 多模型计价与空间展示测试

- 累计费用为所有模型成本之和
- 累计 Token 为所有模型 token 之和
- 当前可用空间只按当前生效模型的 context window 计算
- breakdown 能正确按 Mode 聚合
- breakdown 能正确按 Profile 聚合
- 切换 Mode 后顶部显示的当前模型正确变化

建议位置：

- `packages/core/src/message-utils/__tests__/consolidateMultiModelUsage.spec.ts`
- `webview-ui/src/components/chat/__tests__/TaskHeader.multi-model.spec.tsx`
- `webview-ui/src/components/chat/__tests__/MultiModelUsageBreakdown.spec.tsx`

---

## 15. 验收标准

实现完成后，应满足：

1. 有一个明确的总开关控制“是否按 Mode 使用不同 LLM”
2. 开关关闭时，行为与当前全局模型方案基本一致
3. 开关开启时，切换 Mode 会自动切换到对应的 Provider Profile
4. 不会因为切换 Mode 而新建 task 或丢失上下文
5. 可以把高价值任务交给高级 LLM，把简单任务交给便宜 LLM
6. Mode 切换的多模型衔接可通过 handoff summary 保持稳定
7. 用户可以清楚看到任务累计费用与当前模型上下文是两套不同口径
8. 用户可以查看按 Mode / 按 Profile 的成本分摊
9. 用户可以直观看到哪种 Mode / 模型最消耗成本

---

## 16. 推荐开发达成路径

推荐按下面顺序推进：

1. 先加 `modeLevelLlmRoutingEnabled`
2. 再做 `ModeRoutingResolver`
3. 接入 `ClineProvider.setMode(...)`
4. 加 Settings / Mode UI
5. 接入 `mode handoff summary`
6. 升级 Token / 费用 / 空间展示
7. 最后再把 orchestrator 降级为 legacy

这条路径的优点是：

- 最小风险
- 最大复用现有代码
- 能尽快验证省 Token 效果
- 不阻塞 `Graphics Mode`

---

## 17. 结论

对这个项目来说，未来更合理的多模型架构不是：

- “编排器中心”

而是：

- **“Mode 中心 + 可选多模型路由开关”**

这更符合你的产品方向，也更符合成本目标。

当它与 `mode handoff summary` 结合后，就能形成一条更自然的路径：

- 用 `Mode` 决定工作语义
- 用 `Mode` 绑定合适的 LLM
- 用 `handoff summary` 解决跨模型切换的连续性

这会比继续扩展当前的 Multi-Model Orchestration 更轻、更稳，也更像一个真正会长期演进的产品底座。
