# Mode 切换交接摘要实现方案（最终版）

## 1. 背景

当前工程已经支持：

- `Mode` 与 `Provider Profile / LLM` 分离
- 同一个 `task` 内切换 `mode`
- 同一个 `task` 内切换 `providerProfile`
- Orchestrator 按 `planner / worker / reviewer` 做多阶段切换

现有代码基础已经足够支撑多模型模式链：

- [`packages/types/src/history.ts`](H:/Project/AgentProject/packages/types/src/history.ts) 已持久化 `mode` 与 `apiConfigName`
- [`src/core/task/Task.ts`](H:/Project/AgentProject/src/core/task/Task.ts) 中 `submitUserMessage(text, images, mode, providerProfile)` 已支持按消息切换
- [`src/core/webview/ClineProvider.ts`](H:/Project/AgentProject/src/core/webview/ClineProvider.ts) 已支持 task 级 sticky mode / sticky profile 恢复
- [`src/core/task/OrchestratorEngine.ts`](H:/Project/AgentProject/src/core/task/OrchestratorEngine.ts) 已明确采用“阶段 = Mode + Profile”

所以当前问题不是“记忆是否存在”，而是：

**同一个 task 在切换到不同 Mode / 不同模型后，如何稳定地把上下文、目标、约束、进度交接给下一个模型。**

这份方案的目标，就是补上这一层“模式切换交接摘要”。

---

## 2. 目标

### 2.1 核心目标

在同一个 task 内发生 Mode 或 Profile 切换时，自动生成一份结构化 handoff summary，并在下一次模型请求前稳定注入，让下一个模型快速接住上下文。

### 2.2 达成效果

实现后，以下组合都应具备稳定衔接能力：

- `Code -> Architect`
- `Architect -> Code`
- `Ask -> Code`
- `Code -> Graphics`
- `Graphics -> Code`
- Orchestrator 的 `planner -> worker -> reviewer`

### 2.3 非目标

本方案不做这些事情：

- 不引入“每个模型独立私有记忆”
- 不把 handoff 设计成 RenderDoc 或 Graphics 专属功能
- 不强依赖任何单一 MCP provider
- 不在 V1 中引入一次额外的 LLM 总结请求

---

## 3. 设计原则

### 3.1 最小侵入

优先复用现有：

- `task history`
- `clineMessages`
- `apiConversationHistory`
- `condense / truncation`
- `mode/profile` 切换机制

不要重做一套并行记忆系统。

### 3.2 先确定性，后智能化

V1 先做“程序化提取摘要”，不额外请求模型生成交接总结。

原因：

- 稳定
- 无额外网络依赖
- 无额外成本
- 不阻塞模式切换

后续如需要，可以在 V2 增加“LLM 优化版 handoff”，但只能作为增强层，不能替代确定性版本。

### 3.3 handoff 是 task 能力，不是 mode 特例

该机制必须是通用底座能力，未来 `Graphics`、`Debug`、`Perf`、`Architect`、`Code` 都共用。

### 3.4 handoff 既要“给模型看”，也要“给用户看”

同一份 handoff 需要同时满足：

- 对模型可消费
- 对用户可见
- 对持久化可恢复

---

## 4. 最终方案

## 4.1 总体思路

在 task 内发生 `mode/profile` 切换时：

1. 检测到切换事件
2. 从当前 task 状态中提取结构化交接摘要
3. 生成一条新的 `clineMessage`
4. 在下一次请求 LLM 前，把这条摘要转成一段紧凑的 handoff context 注入 API 输入
5. 注入一次后标记为已消费

一句话概括：

**“UI 中保存一条结构化交接记录，模型侧在下一轮请求前吃到同一份压缩摘要。”**

## 4.2 V1 采用“结构化消息 + 单次上下文注入”

V1 不新建独立数据库，不额外创建新 task，不引入后台总结模型。

只新增两层：

- 一个结构化的 `mode_handoff` 消息类型
- 一个在下一轮请求前执行的 `handoff context injector`

---

## 5. 数据结构设计

## 5.1 新增消息类型

建议在 [`packages/types/src/message.ts`](H:/Project/AgentProject/packages/types/src/message.ts) 中新增：

- `clineSay = "mode_handoff"`
- `ModeHandoffSummary`

建议结构：

```ts
export interface ModeHandoffSummary {
  handoffId: string
  createdAt: number
  trigger: "user_mode_switch" | "tool_switch_mode" | "orchestrator_stage" | "profile_only_switch" | "auto_intent_switch"
  fromMode?: string
  toMode: string
  fromProfile?: string
  toProfile?: string
  objective: string
  completed: string[]
  inProgress: string[]
  pending: string[]
  constraints: string[]
  touchedFiles: string[]
  openQuestions: string[]
  recommendedNextStep?: string
  sourceMessageRange?: {
    fromTs?: number
    toTs?: number
  }
  consumedAt?: number
}
```

对应 `ClineMessage` 建议增加：

```ts
modeHandoff?: ModeHandoffSummary
```

## 5.2 为什么挂在 `ClineMessage` 上

因为当前体系里：

- UI 展示依赖 `clineMessages`
- task 持久化天然保存 `clineMessages`
- 恢复 task 时 `clineMessages` 会被重新加载
- message 删除、编辑、condense、checkpoint 都已有成熟处理链路

这意味着 handoff 放在消息体系里，复用成本最低。

---

## 6. handoff 生成规则

## 6.1 触发时机

V1 仅在以下场景生成 handoff：

1. `submitUserMessage(..., mode, providerProfile)` 指定了新 mode
2. `submitUserMessage(..., mode, providerProfile)` 未换 mode，但换了 profile
3. `OrchestratorEngine` 在 planner / worker / reviewer 阶段切换前
4. 未来 `GraphicsIntentRouter` 触发临时图形模式切换时

## 6.2 不触发的情况

这些情况先不生成 handoff：

- 只是用户打开旧 task
- provider 刷新了状态但没切 mode / profile
- 纯 UI 视图切换

## 6.3 摘要来源

V1 不走 LLM，总结来源采用确定性提取：

- 最近一条用户目标
- 最近若干条 assistant 文本结论
- 当前 todo 列表
- 当前已修改文件
- 当前未处理的 ask / followup
- 当前 orchestrator phase

## 6.4 handoff 内容规则

建议字段生成逻辑如下：

- `objective`
  - 取当前 task 最新的用户目标
- `completed`
  - 从 todo 中已完成项提取
  - 若无 todo，则从最近 assistant 文本里提取“已完成动作”的短句
- `inProgress`
  - 从进行中的 todo、当前 phase、最近工具行为推断
- `pending`
  - 从未完成 todo 提取
- `constraints`
  - 从 mode 语义、只读/读写限制、用户显式约束中提取
- `touchedFiles`
  - 从 task 期间读写过的文件集合提取，建议优先列最近变更文件
- `openQuestions`
  - 若当前处于 followup / approval / review repair 阶段，则写入阻塞点
- `recommendedNextStep`
  - 给下一个 mode 一句明确行动建议

---

## 7. handoff 消费规则

## 7.1 单次注入

handoff 的模型侧注入应采用“单次消费”：

- 创建 handoff 后，标记 `consumedAt = undefined`
- 下一次真正发起 LLM 请求前，将最新未消费 handoff 转成上下文块注入
- 注入后，更新 `consumedAt`

这样可以避免同一份 handoff 在后续多轮里重复污染上下文。

## 7.2 注入格式

建议最终注入给模型的文本块保持非常紧凑：

```text
<mode_handoff>
from_mode: architect
to_mode: code
from_profile: GPT5.5
to_profile: qwen3.7
objective: 修复 marketplace 卡住刷新中的问题
completed:
- 已确认 task/history 会保存 mode 与 profile
- 已定位当前模式切换逻辑位于 Task.submitUserMessage
in_progress:
- 正在实现稳定交接摘要
pending:
- 新增 mode_handoff message schema
- 在下一轮请求前注入 handoff context
constraints:
- 不新增独立记忆系统
- 不阻塞 UI
touched_files:
- src/core/task/Task.ts
- packages/types/src/message.ts
recommended_next_step: 继续实现 handoff 注入与测试
</mode_handoff>
```

## 7.3 注入位置

建议在 [`src/core/task/Task.ts`](H:/Project/AgentProject/src/core/task/Task.ts) 的 API 请求组装链路中接入，优先放在：

- `recursivelyMakeClineRequests(...)` 调用真正 API 前
- 或 `prepareApiConversationMessage(...)` 前的一层 task-level 预处理

目标是：

- 只影响下一轮模型输入
- 不改变用户原始消息内容
- 不污染历史用户消息本身

---

## 8. 与现有 context 管理的关系

## 8.1 与 condense 的关系

当前已有：

- `condense_context`
- `sliding_window_truncation`

handoff 不应与它们冲突，而应协同：

1. handoff 是“模式切换交接摘要”
2. condense 是“长上下文压缩摘要”

建议规则：

- 最新未消费 handoff 永远优先保留
- 如果发生 condense，condense summary 中应包含“最近一次 handoff 的结果”
- 删除消息时，如删除了 handoff 前的上下文，不应让 handoff 成为悬空脏数据

## 8.2 与 sticky mode/profile 的关系

handoff 不是替代 sticky mode/profile。

二者分工：

- sticky mode/profile 负责“恢复到哪个工作状态”
- handoff summary 负责“恢复后如何理解之前做到哪里”

---

## 9. 对 Orchestrator 与 Graphics 的价值

## 9.1 对 Orchestrator

这是最直接的受益方。

当前 `planner -> worker -> reviewer` 虽然已经会切 mode/profile，但主要依赖完整会话历史让下一个模型自己理解上下文。

加入 handoff 后可以变成：

- planner 结束时生成 `Architect -> Code` handoff
- worker 结束时生成 `Code -> Architect` handoff
- repair round 时继续生成 reviewer / worker 往返 handoff

这样会明显降低多模型混搭时的衔接波动。

## 9.2 对 Graphics Mode

未来 `Graphics` 是一个正式 Mode 后，handoff 能直接复用：

- `Code -> Graphics`
  - 交接“当前在修什么、哪几个文件、为什么进入图形分析”
- `Graphics -> Code`
  - 交接“捕获了什么、发现了什么瓶颈、建议改哪些 shader / pass / pipeline 代码”

所以 handoff 是 `Graphics` 生态的重要底座，而不是可有可无的附属功能。

---

## 10. 目录结构建议

建议新增：

```text
src/
  services/
    mode-handoff/
      ModeHandoffTypes.ts
      ModeHandoffExtractor.ts
      ModeHandoffFormatter.ts
      ModeHandoffService.ts
      ModeHandoffRules.ts
  core/
    task/
      Task.ts
      OrchestratorEngine.ts
    webview/
      messageEnhancer.ts

packages/
  types/
    src/
      message.ts
```

### 10.1 各文件职责

- `ModeHandoffTypes.ts`
  - handoff 结构定义
- `ModeHandoffRules.ts`
  - 触发条件、过滤规则、消费规则
- `ModeHandoffExtractor.ts`
  - 从 task / todos / messages / phase 提取结构化数据
- `ModeHandoffFormatter.ts`
  - 把结构化 handoff 转成注入模型的文本块
- `ModeHandoffService.ts`
  - 对外统一入口，负责创建、查询、消费、合并最新 handoff

---

## 11. 具体代码落点

## 11.1 `packages/types/src/message.ts`

要做的事：

1. 为 `clineSays` 新增 `"mode_handoff"`
2. 新增 `modeHandoffSchema`
3. 在 `clineMessageSchema` 中挂载 `modeHandoff`
4. 导出 `ModeHandoffSummary` 类型

这是整个功能的数据基础。

## 11.2 `src/core/task/Task.ts`

这里是核心落点。

建议新增这些方法：

```ts
private async maybeCreateModeHandoff(params: {
  fromMode?: string
  toMode?: string
  fromProfile?: string
  toProfile?: string
  trigger: ModeHandoffTrigger
}): Promise<void>

private async consumePendingModeHandoff(): Promise<string | undefined>

private getLatestPendingModeHandoff(): ModeHandoffSummary | undefined
```

重点接入点：

### A. `submitUserMessage(...)`

当前这里已经会：

- `await provider.setMode(mode)`
- `await provider.setProviderProfile(providerProfile)`

建议改成：

1. 先读取切换前 `taskMode / taskApiConfigName`
2. 执行 mode/profile 切换
3. 若发生变化，则调用 `maybeCreateModeHandoff(...)`
4. 再继续处理用户消息

### B. `recursivelyMakeClineRequests(...)`

在发起下一次模型请求前：

1. 调 `consumePendingModeHandoff()`
2. 若有结果，将其作为额外上下文 prepend 到本轮输入

### C. `persistTask() / taskMetadata()`

这里不一定需要改 history schema，但要确保：

- `clineMessages` 中的 `mode_handoff` 能正常保存与恢复

## 11.3 `src/core/task/OrchestratorEngine.ts`

这里建议显式接入 handoff，而不是只依赖 `Task.submitUserMessage(...)`。

建议在三个阶段切换前后接入：

- planner -> worker
- worker -> reviewer
- reviewer -> worker（repair round）

原因：

- Orchestrator 的切换语义最明确
- 可以给 `trigger = "orchestrator_stage"`
- 能更准确填充 `recommendedNextStep`

## 11.4 `src/core/webview/messageEnhancer.ts`

这里建议为 UI 增加最小展示支持：

- 把 `mode_handoff` 渲染为可读卡片
- 显示 `fromMode -> toMode`
- 显示 `toProfile`
- 展示 `objective / completed / pending / recommendedNextStep`

V1 不需要复杂交互，只要让用户看得见交接发生了什么即可。

## 11.5 `src/core/webview/webviewMessageHandler.ts`

建议补两类兼容处理：

1. 删除消息时，若删除点跨越 handoff 生成区间，需要同时清理悬空 handoff
2. 编辑历史消息后，如 handoff 已不再可信，可标记失效或直接删除后续 handoff

V1 可以采用简单规则：

- 若用户编辑 / 删除 handoff 之前的消息，则删除该时间点之后的 handoff 消息

---

## 12. 开发任务清单

## 12.1 Phase 1：类型与持久化底座

目标：

- 建立 `mode_handoff` 消息结构

任务：

1. 在 `packages/types/src/message.ts` 增加 `mode_handoff`
2. 新增 `ModeHandoffSummary` schema 与类型
3. 确认 task message 持久化链路无需额外改造
4. 为类型与消息序列化补测试

完成标准：

- `mode_handoff` 消息可进入 `clineMessages`
- 重启 / 恢复 task 后仍能读取

## 12.2 Phase 2：生成器与注入器

目标：

- 让切换产生 handoff，并且被下一轮模型吃到

任务：

1. 新增 `src/services/mode-handoff/*`
2. 实现 `ModeHandoffExtractor`
3. 实现 `ModeHandoffFormatter`
4. 在 `Task.submitUserMessage(...)` 中接入 handoff 生成
5. 在 `Task.recursivelyMakeClineRequests(...)` 中接入 handoff 单次注入
6. 增加“已消费”标记逻辑

完成标准：

- 切换 mode 后会出现一条 `mode_handoff`
- 下一轮请求会自动带上 handoff context
- 后续轮次不会重复注入同一份 handoff

## 12.3 Phase 3：Orchestrator 集成

目标：

- 提升多模型模式链稳定性

任务：

1. 在 `OrchestratorEngine.ts` 中显式生成 stage handoff
2. 区分 planner / worker / reviewer 三类 trigger
3. 根据 phase 填充更高质量 `recommendedNextStep`

完成标准：

- `Architect -> Code -> Architect` 往返时有清晰交接链

## 12.4 Phase 4：Webview 展示与编辑兼容

目标：

- 让 handoff 对用户可见且不破坏现有消息编辑删除逻辑

任务：

1. UI 渲染 handoff 卡片
2. 消息增强器支持 handoff
3. 删除 / 编辑历史消息时清理失效 handoff
4. 补 webview 相关测试

完成标准：

- 用户能在对话中看到 handoff
- 编辑历史不会留下脏 handoff

## 12.5 Phase 5：增强版

这部分不进入第一批必须项，但可作为下一阶段：

1. 增加设置项
   - `enableModeHandoffSummary`
   - `modeHandoffMaxTouchedFiles`
   - `modeHandoffUseLlmEnhancement`
2. 支持 `Graphics` Mode 的专项 handoff 模板
3. 支持 provider-specific formatter
4. 支持在 condense 时融合最近 handoff

---

## 13. 测试建议

建议至少补这些测试：

## 13.1 Task 单测

- mode 不变、profile 不变时不生成 handoff
- mode 变化时生成 handoff
- profile-only 切换时生成 handoff
- 下一轮请求只注入一次 handoff
- 多次切换时只消费最新未消费 handoff

建议位置：

- `src/core/task/__tests__/Task.mode-handoff.spec.ts`

## 13.2 Orchestrator 单测

- planner -> worker 生成 handoff
- worker -> reviewer 生成 handoff
- reviewer repair round 重新生成 handoff

建议位置：

- `src/core/task/__tests__/OrchestratorEngine.mode-handoff.spec.ts`

## 13.3 Webview / Message 管理测试

- `mode_handoff` 能正常显示
- 删除历史消息会清理失效 handoff
- condense 后 handoff 不丢失

建议位置：

- `src/core/webview/__tests__/messageEnhancer.mode-handoff.spec.ts`
- `src/core/webview/__tests__/webviewMessageHandler.mode-handoff.spec.ts`

---

## 14. 验收标准

实现完成后，应满足：

1. 同一个 task 下切换 `Code=qwen3.7`、`Architect=GPT5.5`、`Ask=Sonnet 4.7` 时，不会因为切换而丢失连续工作语义
2. 用户可以在 UI 中看到清晰的 handoff 卡片
3. 下一模型能拿到“目标 / 已完成 / 待完成 / 约束 / 关键文件 / 下一步”
4. handoff 不依赖任何单一 MCP 工具或 Graphics provider
5. `Graphics` Mode 后续接入时无需重做这套机制

---

## 15. 最终开发达成路径

推荐按下面顺序落地：

1. 先做 `packages/types/src/message.ts` 的 `mode_handoff` 类型扩展
2. 再做 `src/services/mode-handoff/*` 的提取与格式化服务
3. 接入 `Task.submitUserMessage(...)` 的生成逻辑
4. 接入 `Task.recursivelyMakeClineRequests(...)` 的单次注入逻辑
5. 接入 `OrchestratorEngine.ts` 的显式阶段 handoff
6. 最后补 webview 展示和编辑删除兼容

这条路径的优点是：

- 风险最小
- 每一步都可单独验证
- 不会阻塞你后续继续推进 `Graphics Mode`
- 后面无论接 Qwen / GPT / Sonnet / 未来的 Graphics 专用模型，都能共用同一套交接底座

---

## 16. 结论

这项功能本质上不是“做记忆”，而是“做多模型模式链里的交接协议”。

对于你这个插件未来要走的方向：

- `Code`
- `Architect`
- `Ask`
- `Graphics`
- `Perf`
- 多个不同 LLM / Profile 混合编排

它会是一项非常关键的基础设施能力。

建议将它作为 `Graphics Mode` 之前或并行的底座能力优先完成。
