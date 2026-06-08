# VSCode 插件侧多模型编排落地方案

## 1. 目标

本文档描述一套适用于 VSCode 插件的多模型编排方案：

- `Codex` 负责高价值环节：问题理解、任务拆解、验收、收口
- `DeepSeek / Qwen / Claude / 其他低成本模型` 负责中低风险执行环节：检索、初稿、局部实现、测试样板
- `VSCode 插件` 负责调度、上下文切片、消息管理、patch 应用、自动验证、失败重试

目标不是做一个“所有模型都平权”的系统，而是做一个 `planner-reviewer + worker` 的主从式系统，优先降低成本，同时尽量不牺牲稳定性。

## 2. 非目标

第一版不建议一开始就做下面这些能力：

- 不做完全自治的多 Agent 自由对话
- 不做多个 worker 同时修改同一个文件的复杂合并
- 不做开放式长链路自我反思
- 不做无限循环自动修复
- 不做模型之间直接互相通信

第一版应该坚持：`中心化调度、结构化任务、有限轮次修复、可回放日志`。

## 3. 总体架构

```text
User
  -> VSCode Extension Host
    -> Session Controller
      -> Context Builder
      -> Planner Gateway (Codex)
      -> Router
      -> Worker Gateway (DeepSeek / Qwen / Claude / ...)
      -> Patch Executor
      -> Verifier
      -> Reviewer Gateway (Codex)
      -> Result Composer
  -> Webview UI
```

## 4. 核心流程

```text
1. 用户输入需求
2. 插件收集最小上下文
3. Codex 生成任务树、验收标准、执行约束
4. Router 为每个子任务选择执行模型
5. Worker 执行子任务并输出结构化结果
6. 插件应用 patch 或保存候选变更
7. Verifier 跑 lint / typecheck / test / build
8. Codex 基于任务目标 + diff + 验证结果做验收
9. 若失败，Codex 生成修复子任务并进入下一轮
10. 通过后由 Codex 输出最终总结，返回用户
```

## 5. 模块设计

### 5.1 Session Controller

职责：

- 维护一次用户请求的生命周期
- 跟踪当前轮次、任务树、状态流转
- 协调 planner、worker、reviewer、verifier
- 决定是否继续修复或停止

建议数据结构：

```ts
type SessionState =
  | "created"
  | "planning"
  | "executing"
  | "verifying"
  | "reviewing"
  | "repairing"
  | "completed"
  | "failed"
  | "cancelled"
```

### 5.2 Context Builder

职责：

- 从工作区提取最小必要上下文
- 构造不同模型需要的上下文切片
- 控制 token 成本

建议输入来源：

- 用户问题
- 当前活动文件
- 选中代码
- 最近编辑文件
- 检索结果
- 报错信息
- git diff
- 项目配置文件

建议输出格式：

```ts
interface ContextBundle {
  bundleId: string
  summary: string
  files: ContextFile[]
  symbols: SymbolRef[]
  constraints: string[]
  tokenEstimate: number
}

interface ContextFile {
  path: string
  reason: "active" | "dependency" | "search-hit" | "config" | "test-related"
  content: string
  truncated: boolean
}
```

### 5.3 Planner Gateway

职责：

- 调用 Codex 产出任务树
- 统一生成验收标准、修改边界、风险提示

Codex 产物必须结构化，不建议只返回自然语言。建议强制输出 JSON。

### 5.4 Router

职责：

- 根据任务类型、风险等级、上下文规模、历史表现选择模型

Router 只负责“选择执行者”，不要负责“重新理解任务”。

### 5.5 Worker Gateway

职责：

- 调用便宜模型执行具体子任务
- 接收结构化 patch、分析结果、测试建议
- 记录原始响应，便于回放和审计

### 5.6 Patch Executor

职责：

- 应用 worker 返回的 patch
- 校验 patch 是否越权修改了未授权文件
- 拒绝格式错误或影响范围异常的 patch

### 5.7 Verifier

职责：

- 自动执行验证命令
- 汇总失败日志
- 生成结构化验证报告

### 5.8 Reviewer Gateway

职责：

- 调用 Codex 对执行结果做最终验收
- 决定通过、修复、回滚或转人工确认

## 6. 推荐的任务对象设计

任务对象是整个系统的核心。第一版建议显式区分：

- `plan task`：规划任务
- `exec task`：执行任务
- `repair task`：修复任务
- `review task`：验收任务

### 6.1 基础任务对象

```ts
type TaskStatus =
  | "pending"
  | "ready"
  | "running"
  | "succeeded"
  | "failed"
  | "blocked"
  | "cancelled"

type TaskKind = "plan" | "exec" | "repair" | "review"

interface TaskRef {
  taskId: string
  title: string
}

interface AcceptanceCriterion {
  id: string
  description: string
  required: boolean
  verificationHint?: string
}

interface TaskConstraint {
  type:
    | "allowed_files"
    | "forbidden_files"
    | "max_diff_lines"
    | "must_add_tests"
    | "no_api_change"
    | "preserve_behavior"
    | "output_format"
  value: unknown
}

interface ModelPreference {
  provider: "codex" | "deepseek" | "qwen" | "claude" | "auto"
  model?: string
  reasoningEffort?: "low" | "medium" | "high"
}

interface OrchestratorTask {
  taskId: string
  parentTaskId?: string
  sessionId: string
  kind: TaskKind
  title: string
  objective: string
  status: TaskStatus
  priority: 1 | 2 | 3 | 4 | 5
  dependsOn: TaskRef[]
  contextBundleIds: string[]
  inputs: Record<string, unknown>
  constraints: TaskConstraint[]
  acceptanceCriteria: AcceptanceCriterion[]
  preferredModel: ModelPreference
  retryCount: number
  maxRetries: number
  createdAt: string
  updatedAt: string
}
```

### 6.2 执行任务扩展

```ts
interface ExecTask extends OrchestratorTask {
  kind: "exec" | "repair"
  allowedWritePaths: string[]
  expectedOutputs: Array<"patch" | "analysis" | "test_plan" | "command_suggestion">
  riskLevel: "low" | "medium" | "high"
}
```

### 6.3 验收任务扩展

```ts
interface ReviewTask extends OrchestratorTask {
  kind: "review"
  reviewInputs: {
    changedFiles: string[]
    unifiedDiff: string
    verificationReportId?: string
    originalUserRequest: string
  }
}
```

## 7. 消息协议设计

建议插件内部采用 `envelope + payload` 形式，便于：

- 统一记录日志
- 支持扩展
- 支持 UI 实时展示
- 支持以后接入远端 orchestrator 服务

### 7.1 通用消息封装

```ts
interface MessageEnvelope<T = unknown> {
  version: "1.0"
  messageId: string
  sessionId: string
  traceId: string
  timestamp: string
  source:
    | "ui"
    | "extension"
    | "planner"
    | "router"
    | "worker"
    | "verifier"
    | "reviewer"
  target:
    | "ui"
    | "extension"
    | "planner"
    | "router"
    | "worker"
    | "verifier"
    | "reviewer"
  type: string
  payload: T
}
```

### 7.2 UI -> Extension 消息

```ts
type UiToExtensionMessage =
  | MessageEnvelope<StartSessionPayload>
  | MessageEnvelope<ApprovePlanPayload>
  | MessageEnvelope<CancelSessionPayload>
  | MessageEnvelope<RetryTaskPayload>

interface StartSessionPayload {
  type: "session.start"
  userRequest: string
  activeFile?: string
  selectedText?: string
  userSettings: {
    maxBudgetUsd?: number
    preferredCheapModel?: string
    allowAutoApply?: boolean
    maxRepairRounds?: number
  }
}
```

### 7.3 Extension -> Planner 消息

```ts
interface PlanRequestPayload {
  type: "plan.request"
  userRequest: string
  context: ContextBundle
  planningPolicy: {
    maxDepth: number
    preferParallelizableTasks: boolean
    requireAcceptanceCriteria: true
    requireAllowedWritePaths: true
  }
}
```

### 7.4 Planner -> Extension 响应

```ts
interface PlanResponsePayload {
  type: "plan.response"
  planSummary: string
  assumptions: string[]
  risks: string[]
  tasks: ExecTask[]
  finalReviewTemplate: {
    successDefinition: string
    mustCheckItems: string[]
  }
}
```

### 7.5 Extension -> Worker 消息

```ts
interface ExecuteTaskPayload {
  type: "task.execute"
  task: ExecTask
  context: ContextBundle
  executionPolicy: {
    requireStructuredOutput: true
    rejectOutOfScopeChanges: true
    patchFormat: "unified_diff"
    canSuggestCommands: boolean
  }
}
```

### 7.6 Worker -> Extension 响应

```ts
interface WorkerResultPayload {
  type: "task.result"
  taskId: string
  status: "succeeded" | "failed" | "blocked"
  summary: string
  reasoningSummary: string
  outputs: {
    patch?: {
      format: "unified_diff"
      content: string
      changedFiles: string[]
    }
    analysis?: string
    testPlan?: string[]
    commandSuggestions?: string[]
  }
  warnings: string[]
}
```

### 7.7 Extension -> Verifier 消息

```ts
interface VerifyRequestPayload {
  type: "verify.request"
  taskId: string
  changedFiles: string[]
  commands: string[]
}
```

### 7.8 Verifier -> Extension 响应

```ts
interface VerifyResponsePayload {
  type: "verify.response"
  taskId: string
  overallStatus: "passed" | "failed" | "partial"
  commandResults: Array<{
    command: string
    exitCode: number
    stdout: string
    stderr: string
    durationMs: number
  }>
  summary: string
}
```

### 7.9 Extension -> Reviewer 消息

```ts
interface ReviewRequestPayload {
  type: "review.request"
  originalUserRequest: string
  planSummary: string
  executedTasks: ExecTask[]
  diff: string
  verification: VerifyResponsePayload
  reviewPolicy: {
    mayRequestRepair: true
    maxRepairRounds: number
    requireDecision: true
  }
}
```

### 7.10 Reviewer -> Extension 响应

```ts
interface ReviewResponsePayload {
  type: "review.response"
  decision: "accept" | "repair" | "reject" | "needs_user_confirmation"
  summary: string
  findings: Array<{
    severity: "high" | "medium" | "low"
    file?: string
    message: string
  }>
  repairTasks?: ExecTask[]
  userConfirmationQuestion?: string
}
```

## 8. 路由策略设计

第一版不要做过度复杂的机器学习路由，使用 `规则优先 + 成本阈值 + 回退机制` 即可。

### 8.1 推荐路由原则

`Codex` 负责：

- 任务规划
- 跨文件设计
- 模糊需求澄清
- 高风险代码修改
- 最终代码审查
- 修复失败后的重新拆解

`DeepSeek / Qwen` 负责：

- 单文件修改
- 样板代码生成
- 单元测试初稿
- 日志归纳
- 文档整理
- 搜索结果摘要

`Claude` 可选负责：

- 中等复杂度重构
- 长文本理解
- 复杂测试用例草拟

### 8.2 路由维度

建议至少使用下面几个维度：

- `taskKind`
- `riskLevel`
- `fileCount`
- `estimatedTokens`
- `requiresArchitectureDecision`
- `requiresBehaviorPreservation`
- `historicalFailureCount`
- `budgetPressure`

### 8.3 示例路由表

| 条件 | 首选模型 | 回退模型 |
| --- | --- | --- |
| 任务规划 / 任务重拆 | Codex | Claude |
| 单文件、小于 150 行 diff | DeepSeek | Qwen |
| 单元测试初稿 | DeepSeek | Qwen |
| 跨 3 个以上文件重构 | Codex | Claude |
| 包含公共接口变更 | Codex | Claude |
| 验收失败后的修补 | Codex 先拆，DeepSeek 再修 | Qwen |
| 文档和说明生成 | Qwen | DeepSeek |
| 高风险逻辑修复 | Codex | Claude |

### 8.4 伪代码

```ts
function routeTask(task: ExecTask, runtime: RuntimeSignals): ModelPreference {
  if (task.kind === "plan" || task.kind === "review") {
    return { provider: "codex", reasoningEffort: "high" }
  }

  if (task.riskLevel === "high") {
    return { provider: "codex", reasoningEffort: "high" }
  }

  if (runtime.budgetPressure === "high" && task.riskLevel === "low") {
    return { provider: "deepseek", reasoningEffort: "low" }
  }

  if (task.allowedWritePaths.length === 1 && runtime.estimatedDiffLines < 150) {
    return { provider: "deepseek", reasoningEffort: "medium" }
  }

  if (runtime.historicalFailureCount >= 2) {
    return { provider: "codex", reasoningEffort: "high" }
  }

  return { provider: "qwen", reasoningEffort: "medium" }
}
```

## 9. Prompt 契约设计

你后面让其他模型实现时，建议把“Prompt 契约”当成接口文档的一部分，而不是散落在代码里。

### 9.1 Planner Prompt 契约

Planner 必须输出：

- 任务拆解
- 每个任务的目标
- 允许修改文件
- 禁止修改文件
- 验收标准
- 风险等级
- 推荐执行模型

禁止 Planner 输出：

- 非结构化长篇建议
- 模糊描述，如“适当修改”“按需优化”

### 9.2 Worker Prompt 契约

Worker 必须遵守：

- 只修改授权文件
- 只输出指定格式
- 若信息不足，返回 `blocked`
- 若建议命令，必须标注用途
- 不得擅自扩展需求

### 9.3 Reviewer Prompt 契约

Reviewer 必须给出明确决策：

- `accept`
- `repair`
- `reject`
- `needs_user_confirmation`

禁止只输出“看起来不错”这类软结论。

## 10. 验收循环设计

这是最关键的部分。建议使用 `有限轮修复` 而不是无限自循环。

### 10.1 状态机

```text
created
  -> planning
  -> executing
  -> verifying
  -> reviewing
  -> completed

reviewing -> repairing -> executing
reviewing -> failed
reviewing -> cancelled
```

### 10.2 推荐循环策略

- 默认最多 `2` 轮 repair
- 单轮 repair 只修 reviewer 明确指出的问题
- repair 任务必须继承原任务的写入边界
- 每次 repair 后都重新验证
- 超过最大轮次后停止自动修复，转人工确认

### 10.3 推荐判定逻辑

```ts
function nextStep(review: ReviewResponsePayload, rounds: number, maxRounds: number) {
  if (review.decision === "accept") return "completed"
  if (review.decision === "needs_user_confirmation") return "await_user"
  if (review.decision === "reject") return "failed"
  if (review.decision === "repair" && rounds < maxRounds) return "repair"
  return "failed"
}
```

### 10.4 Repair Task 生成原则

repair task 不应该重新描述整道题，而应该只包含：

- reviewer 发现的问题
- 对应文件
- 最小必要上下文
- 原验收标准中未通过的条目

示例：

```json
{
  "taskId": "repair-2",
  "kind": "repair",
  "title": "Fix failing telemetry test after config change",
  "objective": "Repair the failing test introduced by the previous patch without changing runtime behavior.",
  "allowedWritePaths": [
    "src/config.ts",
    "src/__tests__/config.spec.ts"
  ],
  "acceptanceCriteria": [
    {
      "id": "ac-1",
      "description": "All config tests pass",
      "required": true
    },
    {
      "id": "ac-2",
      "description": "Do not change public API shape",
      "required": true
    }
  ]
}
```

## 11. Patch 策略

第一版建议统一要求 worker 输出 `unified diff`，不要让不同模型返回不同 patch 格式。

原因：

- 容易审计
- 容易做 scope check
- 容易做 dry-run
- 容易回滚

建议 patch 应用流程：

1. 检查 diff 格式是否合法
2. 检查涉及文件是否都在 `allowedWritePaths`
3. 检查 diff 行数是否超过 `max_diff_lines`
4. 尝试 dry-run apply
5. 真正 apply
6. 记录变更快照

## 12. 自动验证设计

Verifier 不要一上来就跑所有命令。建议做分层策略：

### 12.1 命令分层

- `fast`: 格式检查、局部测试、类型检查
- `standard`: lint + typecheck + targeted test
- `full`: standard + build + integration test

### 12.2 选择策略

- 单文件低风险修改：`fast`
- 多文件或逻辑改动：`standard`
- 配置/构建/基础设施改动：`full`

### 12.3 验证报告对象

```ts
interface VerificationReport {
  reportId: string
  sessionId: string
  status: "passed" | "failed" | "partial"
  profile: "fast" | "standard" | "full"
  commandResults: Array<{
    command: string
    exitCode: number
    summary: string
    stdoutPath?: string
    stderrPath?: string
  }>
  failedCriteriaIds: string[]
  generatedAt: string
}
```

## 13. UI 交互建议

Webview 不需要暴露全部内部细节，但建议让用户看见下面这些关键信息：

- 当前阶段：planning / executing / verifying / reviewing
- 当前使用的模型
- 当前子任务标题
- 修改文件列表
- 是否通过自动验证
- 是否进入 repair 回合
- 当前累计成本和轮次

建议 UI 至少提供三个控制按钮：

- `停止`
- `仅查看计划`
- `允许自动应用 patch`

## 14. 存储与可观测性

建议把每次会话都保存为可回放记录，便于后续优化路由。

### 14.1 建议落盘对象

- session metadata
- 原始用户请求
- context bundle 摘要
- planner 输出
- worker 原始响应
- verifier 报告
- reviewer 决策
- 最终 diff
- 成本统计

### 14.2 关键指标

- `plan_to_accept_rate`
- `repair_round_avg`
- `worker_first_pass_success_rate`
- `cost_per_accepted_task`
- `tokens_by_provider`
- `verification_failure_rate`
- `user_interrupt_rate`

## 15. 第一版实现边界

建议 MVP 范围如下：

- 只支持单会话串行执行
- 只支持一个 planner：Codex
- 只支持两个 worker 提供商：DeepSeek + Qwen
- 只支持 unified diff
- 只支持最多 2 轮 repair
- 只支持本地验证命令
- 只支持基于规则的路由

不要在 MVP 做：

- 并行修改同一文件
- 自动 git 分支管理
- 向量数据库长期记忆
- 自定义 DSL workflow editor
- 复杂的概率打分路由

## 16. 推荐实现顺序

### Phase 1

- 定义任务对象
- 定义消息协议
- 接入 Codex planner
- 接入单个 cheap worker
- 支持结构化 patch 输出

### Phase 2

- 增加 patch scope check
- 增加 verifier
- 增加 Codex reviewer
- 打通 repair loop

### Phase 3

- 增加多 worker 路由
- 增加成本统计
- 增加 UI 状态展示
- 增加会话落盘与回放

### Phase 4

- 增加局部并行任务
- 增加命令策略配置
- 增加历史表现驱动的路由优化

## 17. 建议的代码目录

```text
src/
  orchestrator/
    session-controller.ts
    router.ts
    state-machine.ts
    repair-loop.ts
  planner/
    codex-planner.ts
    planner-prompts.ts
  workers/
    deepseek-worker.ts
    qwen-worker.ts
    worker-prompts.ts
  reviewer/
    codex-reviewer.ts
    reviewer-prompts.ts
  context/
    context-builder.ts
    search-context.ts
    diff-context.ts
  patch/
    patch-validator.ts
    patch-executor.ts
  verifier/
    verifier.ts
    command-profiles.ts
  protocol/
    messages.ts
    tasks.ts
    reports.ts
  storage/
    session-store.ts
    trace-store.ts
```

## 18. 给实现模型的明确要求

你把这份文档交给 Claude Code、Qwen、DeepSeek 去实现时，建议额外加一段硬性要求：

```text
请严格按文档中的协议和对象建模实现，不要擅自重命名核心字段。
先完成 types / protocol / state machine，再接入 provider。
所有 provider 输出必须经过结构化解析，禁止直接信任自然语言响应。
任何 patch 应用前必须做 allowedWritePaths 校验。
任何 review 阶段都必须返回 accept / repair / reject / needs_user_confirmation 之一。
```

## 19. 我最推荐的默认策略

如果你要一个最实用的默认版本，我建议这样定：

- `Codex`：只做 `plan + review + complex repair planning`
- `DeepSeek`：做 `simple exec + test draft + doc draft`
- `Qwen`：做 `fallback exec + summary`
- `插件`：做 `context slicing + routing + patch apply + verification + persistence`

这套策略的优点是：

- 降本非常明显
- 系统边界清楚
- 出问题容易定位
- 后续可以逐步替换 worker，而不用重写 orchestrator

## 20. 最终结论

这套插件侧方案的关键不是“接多少模型”，而是三件事：

1. `Codex` 只做高价值决策，不做所有脏活
2. 便宜模型只拿到边界清晰、上下文受控的执行任务
3. 插件自己掌握状态机、patch 权限、验证和验收闭环

如果这三点守住了，这套系统就具备很强的工程可落地性。
