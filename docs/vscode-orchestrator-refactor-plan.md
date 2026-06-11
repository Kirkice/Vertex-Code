# 编排器重构方案：融入 Task 工作流

> 将编排器从独立系统重构为 Task 内部的多模型协作工作流模式，
> 解决编排对话无法出现在历史面板、刷新后丢失等问题。

**文档版本**：v1.0
**创建日期**：2026-06-11
**状态**：待实施

---

## 1. 问题背景

### 1.1 当前架构问题

当前编排器被实现为一个与 Task 平行的独立系统：

```
用户发消息 → orchestratorEnabled?
    ├── 是 → OrchestratorBridge → OrchestratorSession（独立系统）
    └── 否 → createTask()（正常 Task 流程）
```

**核心问题**：

| 问题 | 影响 |
|------|------|
| OrchestratorSession 和 Task 是两套独立的类 | 消息系统不共享 |
| orchestratorChatMessage 和 clineMessages 独立存储 | 编排对话不进入 taskHistoryStore |
| 编排器状态仅存在内存中的 Map | 刷新后丢失 |
| 编排会话不出现在历史对话列表 | 用户无法回看编排对话 |

### 1.2 正确的设计认知

编排器本质上只是 Task 的一种工作流模式——在对话过程中，API 调用在 Planner / Worker / Reviewer 三个角色之间切换，但**对话本身仍然是 Task**。

```
正确认知：
Task（编排模式）= Task + 多模型角色切换流程
                ≠ 独立于 Task 之外的新系统
```

---

## 2. 目标架构

```
用户发消息 → 创建 Task（无论是否启用编排器）
                │
                └── Task 内部判断 orchestratorMode.enabled?
                    ├── 否 → 单模型 agent 循环（现有流程）
                    └── 是 → 多模型协作循环：
                            ├── Planner 调用（plannerProfile）→ say() 写入 clineMessages
                            ├── Worker 调用（workerProfile）→ say() 写入 clineMessages
                            └── Reviewer 调用（reviewerProfile）→ say() 写入 clineMessages
```

**核心变化**：
- 编排器不再有独立的 Session/SessionManager
- 所有消息统一通过 Task 的 `say()` 方法写入 `clineMessages`
- 编排对话自动享受 Task 的历史持久化、恢复、面板展示等能力
- 气泡上显示角色标签（🧠⚡🔍）和对应模型名

---

## 3. 实现阶段

### 阶段 1：类型系统升级（前置准备）

**目标**：扩展 ClineMessage 和 Task 类型以携带编排器所需的全部信息

#### 1.1 ClineMessage 新增字段

**文件**：`packages/types/src/message.ts`

```typescript
// 已有字段
orchestratorRole: z.enum(["planner", "worker", "reviewer"]).optional(),

// 新增字段
orchestratorModelId: z.string().optional(),  // 当前角色使用的模型标识，如 "qwen-max", "deepseek-chat"
```

#### 1.2 Task 编排模式类型

**文件**：`packages/types/src/task.ts`

```typescript
/**
 * 编排模式配置
 */
export interface OrchestratorModeConfig {
  enabled: boolean
  plannerProfile?: string       // Planner 使用的 Provider Profile 名称
  workerProfile?: string        // Worker 使用的 Provider Profile 名称
  reviewerProfile?: string      // Reviewer 使用的 Provider Profile 名称
  maxRepairRounds: number       // 最大修复轮次，默认 2
}

/**
 * 编排模式运行时状态
 */
export interface OrchestratorModeState {
  phase: "planning" | "awaiting_approval" | "executing" | "reviewing" | "repairing" | "completed" | "failed"
  repairRound: number
  plan?: PlanResponsePayload
  tasks: OrchestratorTask[]
}
```

**依赖**：无

---

### 阶段 2：Task 内部编排引擎（核心）

**目标**：Task 具备编排模式能力，替代 OrchestratorSessionManager

#### 2.1 Task 新增编排模式字段

**文件**：`src/core/task/Task.ts`

```typescript
class Task extends EventEmitter<TaskEvents> implements TaskLike {
  // 新增：编排模式配置和状态
  readonly orchestratorMode?: OrchestratorModeConfig
  private orchestratorState?: OrchestratorModeState
  private orchestratorEngine?: OrchestratorEngine

  // 构造函数增加编排模式参数
  constructor(options: TaskOptions & { orchestratorMode?: OrchestratorModeConfig }) {
    // ...
    if (options.orchestratorMode?.enabled) {
      this.orchestratorMode = options.orchestratorMode
      this.orchestratorEngine = new OrchestratorEngine(this)
    }
  }
}
```

#### 2.2 新建 OrchestratorEngine

**文件**：`src/core/task/OrchestratorEngine.ts`

从现有 `OrchestratorSessionManager` 提取核心编排逻辑，但不管理 session/message，只输出编排指令给 Task：

```typescript
export class OrchestratorEngine {
  constructor(private task: Task) {}

  /**
   * 执行编排循环
   * Task 调用此方法启动编排模式
   */
  async run(userRequest: string): Promise<void> {
    // 1. Planning 阶段
    await this.runPlanningPhase(userRequest)

    // 2. 等待用户审批
    await this.waitForApproval()

    // 3. Execution + Review 循环
    await this.runExecutionLoop()
  }

  private async runPlanningPhase(userRequest: string): Promise<void> {
    // 切换到 plannerProfile
    // 调用 CodexPlanner.plan()
    // 通过 task.say() 输出计划，标记 orchestratorRole: "planner"
  }

  private async waitForApproval(): Promise<void> {
    // 通过 task.ask() 请求用户审批
    // 用户点击 "Approve Plan" 后继续
  }

  private async runExecutionLoop(): Promise<void> {
    // Worker 阶段：切换到 workerProfile，复用 Task 的 agent 循环
    // Reviewer 阶段：切换到 reviewerProfile，调用 CodexReviewer
    // 如需修复 → 回到 Worker（最多 maxRepairRounds 轮）
  }
}
```

**关键设计**：OrchestratorEngine 不直接操作 webview，所有 UI 交互通过 Task 的 `say()` / `ask()` 方法完成。

#### 2.3 编排消息统一通过 say() 写入

```typescript
// OrchestratorEngine 内部
await this.task.say("text", planText, {
  orchestratorRole: "planner",
  orchestratorModelId: this.task.orchestratorMode!.plannerProfile,
})

await this.task.say("text", workerOutput, {
  orchestratorRole: "worker",
  orchestratorModelId: this.task.orchestratorMode!.workerProfile,
})

await this.task.say("text", reviewResult, {
  orchestratorRole: "reviewer",
  orchestratorModelId: this.task.orchestratorMode!.reviewerProfile,
})
```

#### 2.4 编排模式入口

**文件**：`src/core/task/Task.ts`

```typescript
// Task 初始化时
async initTask(userMessage: string): Promise<void> {
  if (this.orchestratorMode?.enabled && this.orchestratorEngine) {
    await this.orchestratorEngine.run(userMessage)
  } else {
    // 现有普通 agent 循环
    await this.recursivelyMakeClineRequests(...)
  }
}
```

**依赖**：阶段 1

---

### 阶段 3：消息路由统一

**目标**：webviewMessageHandler 不再为编排器设独立分支，统一走 Task

#### 3.1 移除 orchestrator 独立分支

**文件**：`src/core/webview/webviewMessageHandler.ts`

```typescript
// 改造前
if (orchestratorEnabled) {
  await provider.orchestratorBridge.startSession(...)
} else {
  await provider.createNewTask(...)
}

// 改造后
const orchestratorMode = orchestratorEnabled ? {
  enabled: true,
  plannerProfile: config.orchestratorConfig?.plannerProfile,
  workerProfile: config.orchestratorConfig?.workerProfile,
  reviewerProfile: config.orchestratorConfig?.reviewerProfile,
  maxRepairRounds: config.orchestratorConfig?.routingPolicy?.maxRepairRounds ?? 2,
} : undefined

await provider.createNewTask(text, { orchestratorMode })
```

#### 3.2 approvePlan 和 cancel 消息改造

```typescript
// 改造前
case "orchestratorApprovePlan":
  await provider.orchestratorBridge.approvePlan(sessionId)

// 改造后
case "orchestratorApprovePlan":
  const currentTask = provider.getCurrentTask()
  await currentTask.approveOrchestratorPlan()
```

#### 3.3 ClineProvider 改造

**文件**：`src/core/webview/ClineProvider.ts`

- 移除 `orchestratorBridge` 字段
- `createNewTask()` 增加 `orchestratorMode` 参数传递

**依赖**：阶段 2

---

### 阶段 4：UI 渲染升级

**目标**：气泡显示角色标签 + 模型名，编排面板从 Task 状态读取

#### 4.1 补全 ChatRow 角色配置

**文件**：`webview-ui/src/components/chat/ChatRow.tsx`

```typescript
const roleIcons: Record<string, { icon: string; label: string; color: string }> = {
  planner:  { icon: "🧠", label: "计划者", color: "#7c3aed" },
  worker:   { icon: "⚡", label: "执行者", color: "#2563eb" },
  reviewer: { icon: "🔍", label: "审核者", color: "#059669" },
}
```

#### 4.2 渲染模型名

**文件**：`webview-ui/src/components/chat/ChatRow.tsx`

```typescript
// 气泡头部渲染
{roleCfg && (
  <span style={{ ... }}>
    {roleCfg.icon} {roleCfg.label}
    {message.orchestratorModelId && (
      <span style={{ fontSize: "0.85em", opacity: 0.7, marginLeft: 6 }}>
        · {message.orchestratorModelId}
      </span>
    )}
  </span>
)}
```

**渲染效果**：
```
🧠 计划者 · qwen-max
⚡ 执行者 · deepseek-chat
🔍 审核者 · gpt-4o
```

#### 4.3 移除 orchestratorChatMessage 特殊处理

**文件**：`webview-ui/src/context/ExtensionStateContext.tsx`

- 删除 `case "orchestratorChatMessage"` 分支
- 编排消息已作为普通 ClineMessage 存在 clineMessages 中，无需特殊处理

#### 4.4 编排面板数据源改造

**文件**：`webview-ui/src/components/chat/OrchestratorSessionPanel.tsx`

- 不再监听 `orchestratorSessionUpdate` 消息
- 从 Task 状态（clineMessages 中的编排消息 + Task 的 orchestratorState）读取数据

**依赖**：阶段 3

---

### 阶段 5：清理旧代码

**目标**：删除不再需要的独立编排器系统

#### 5.1 删除文件

| 文件 | 说明 |
|------|------|
| `src/core/webview/orchestratorBridge.ts` | 编排器桥接层，不再需要 |
| `src/orchestrator/session/OrchestratorSession.ts` | 独立会话类，逻辑已移入 Task |
| `src/orchestrator/session/OrchestratorSessionManager.ts` | 独立会话管理器，逻辑已移入 OrchestratorEngine |
| `src/orchestrator/session/stateMachine.ts` | 独立状态机，逻辑简化后移入 Task |
| `src/orchestrator/session/repairLoop.ts` | 修复循环，逻辑移入 OrchestratorEngine |

#### 5.2 清理引用

| 文件 | 清理内容 |
|------|----------|
| `src/core/webview/ClineProvider.ts` | 移除 `orchestratorBridge` 字段和 import |
| `src/core/webview/webviewMessageHandler.ts` | 移除 orchestratorBridge 动态 import |
| `webview-ui/src/context/ExtensionStateContext.tsx` | 移除 orchestratorChatMessage 处理 |

#### 5.3 保留文件（移入 Task 体系）

| 文件 | 用途 | 新位置 |
|------|------|--------|
| `src/orchestrator/planner/CodexPlanner.ts` | Planner 调用逻辑 | 保持原位，被 OrchestratorEngine 引用 |
| `src/orchestrator/planner/planner-prompts.ts` | Planner 提示词 | 保持原位 |
| `src/orchestrator/reviewer/CodexReviewer.ts` | Reviewer 调用逻辑 | 保持原位，被 OrchestratorEngine 引用 |
| `src/orchestrator/reviewer/reviewer-prompts.ts` | Reviewer 提示词 | 保持原位 |
| `src/orchestrator/worker/ExecTaskRunner.ts` | Worker 执行逻辑 | 保持原位 |
| `src/orchestrator/worker/worker-prompts.ts` | Worker 提示词 | 保持原位 |
| `src/orchestrator/router/TaskRouter.ts` | 模型路由策略 | 保持原位 |
| `src/orchestrator/context/ContextBundleBuilder.ts` | 上下文构建 | 保持原位 |

**依赖**：阶段 3、4 完成后

---

### 阶段 6：验证与测试

| 验证项 | 预期结果 |
|--------|----------|
| 普通 Task 流程 | 不受影响，回归通过 |
| 编排模式 Task 对话 | 出现在历史面板中 |
| 刷新后恢复 | 编排对话刷新后可恢复查看 |
| 气泡角色标签 | 正确显示 🧠⚡🔍 图标和中文标签 |
| 气泡模型名 | 正确显示对应角色使用的模型 |
| 修复循环 | Reviewer 打回后 Worker 重新执行，最多 N 轮 |
| 简单任务 DIRECT | Planner 判断为简单问题时直接回答，不进入完整流程 |
| 历史对话回看 | 编排对话的历史记录可正常打开和查看 |

**依赖**：阶段 5

---

## 4. 依赖关系图

```
阶段1（类型系统）
    ↓
阶段2（Task 编排引擎）← 核心步骤
    ↓
阶段3（消息路由统一）
    ↓
阶段4（UI 渲染升级）
    ↓
阶段5（清理旧代码）
    ↓
阶段6（验证与测试）
```

---

## 5. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 阶段 2 改动影响 Task 核心流程 | 中 | 高 | 通过 `orchestratorMode` 条件守卫，确保不影响普通模式 |
| 编排模式 Profile 切换导致 API 调用异常 | 低 | 中 | 增加 Profile 存在性校验，失败时 fallback 到默认 Profile |
| 旧编排面板 UI 改造工作量 | 低 | 低 | 面板组件已有，只需改数据源 |
| 历史数据兼容 | 低 | 低 | 旧编排会话数据（内存中）本就无持久化，无需迁移 |

---

## 6. 里程碑

| 里程碑 | 完成标志 | 预计工作量 |
|--------|----------|------------|
| M1：类型就绪 | ClineMessage 和 Task 类型扩展完成 | 0.5 天 |
| M2：引擎可用 | OrchestratorEngine 在 Task 内跑通完整编排流程 | 2 天 |
| M3：路由统一 | webviewMessageHandler 不再有编排器分支 | 1 天 |
| M4：UI 就绪 | 气泡显示角色+模型名，面板正常 | 1 天 |
| M5：清理完成 | 旧代码删除，无编译错误 | 0.5 天 |
| M6：发布就绪 | 全部测试通过 | 1 天 |

**总计预计**：6 个工作日

---

*文档版本：v1.0*
*最后更新：2026-06-11*