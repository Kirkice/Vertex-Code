# Orchestrator Mode Chain Design

> 将编排模式从"独立组件系统"重构为"Mode 链式切换"，
> 复用现有 Mode 系统（Architect/Code）处理简单和复杂任务。

**版本**: v1.0
**日期**: 2026-06-11
**状态**: 实施中

---

## 1. 核心理念

```
Mode = 预设工作模式（Architect、Code、Ask、Debug...）
     → 决定 system prompt、工具集、行为方式

编排阶段 = 流程步骤（Planner、Worker、Reviewer）
         → 每个阶段 = 一个 Mode + 一个模型
```

**Mode 切换本身就解决了简单/复杂任务的分流问题。**

---

## 2. 阶段与 Mode 映射

| 阶段 | 默认 Mode | 默认模型 | 权限 | 职责 |
|------|----------|---------|------|------|
| Planner（计划者） | Architect | plannerProfile | 只读 | 分析、规划、直接回复 |
| Worker（执行者） | Code | workerProfile | 读写 | 按计划执行代码修改 |
| Reviewer（审核者） | Architect | reviewerProfile | 只读 | 审查执行结果 |

> 未来：用户可在编排设置面板中自选每个阶段的 Mode。

---

## 3. 工作流程

```
用户消息 → 进入编排模式
    │
    ▼
┌─ Planner 阶段 ────────────────────────────────┐
│  Mode: Architect (只读)                         │
│  Model: plannerProfile                          │
│  行为: 读文件、分析、输出自然语言                  │
│                                                 │
│  "你好" → Architect 直接对话 → 完成 ✅           │
│  "整合文档" → Architect 输出计划 → 等待审批      │
└─────────────────────────────────────────────────┘
    │
    ├─ 直接回复 → 完成 ✅
    └─ 输出计划 → 等待用户审批 → Worker 阶段
                          │
                          ▼
              ┌─ Worker 阶段 ───────────────────────┐
              │  Mode: Code (读写)                    │
              │  Model: workerProfile                 │
              │  行为: 按计划执行，读写文件            │
              └───────────────────────────────────────┘
                          │
                          ▼
              ┌─ Reviewer 阶段 ─────────────────────┐
              │  Mode: Architect (只读)               │
              │  Model: reviewerProfile               │
              │  行为: 审查执行结果                    │
              │  "通过" → 完成 ✅                     │
              │  "需修复" → 回到 Worker (最多 N 轮)   │
              └───────────────────────────────────────┘
```

---

## 4. 配置结构

```typescript
interface OrchestratorModeConfig {
  enabled: boolean
  plannerMode: string      // 默认 "architect"
  plannerProfile: string   // 模型 profile 名
  workerMode: string       // 默认 "code"
  workerProfile: string    // 模型 profile 名
  reviewerMode: string     // 默认 "architect"
  reviewerProfile: string  // 模型 profile 名
  maxRepairRounds: number  // 默认 2
}
```

---

## 5. OrchestratorEngine 核心逻辑

```typescript
class OrchestratorEngine {
  async run(userMessage: string) {
    // Phase 1: Planner
    await this.task.setMode(config.plannerMode)
    await this.task.setProfile(config.plannerProfile)
    await this.runAgentLoop(userMessage)

    // If Architect replied directly (attempt_completion) → done
    if (taskCompleted) { this.phase = "completed"; return }

    // Otherwise plan was generated → wait for approval
    this.phase = "awaiting_approval"
  }

  async approvePlan() {
    // Phase 2: Worker
    await this.task.setMode(config.workerMode)
    await this.task.setProfile(config.workerProfile)
    await this.runAgentLoop("Execute the plan above")

    // Phase 3: Reviewer
    await this.runReview()
  }

  async runReview() {
    await this.task.setMode(config.reviewerMode)
    await this.task.setProfile(config.reviewerProfile)
    await this.runAgentLoop("Review execution results")

    // If needs repair → back to Worker (up to maxRepairRounds)
  }
}
```

---

## 6. 废弃文件

```
删除:
  src/orchestrator/planner/CodexPlanner.ts
  src/orchestrator/planner/planner-prompts.ts
  src/orchestrator/worker/ExecTaskRunner.ts
  src/orchestrator/worker/worker-prompts.ts
  src/orchestrator/reviewer/CodexReviewer.ts
  src/orchestrator/reviewer/reviewer-prompts.ts
  src/orchestrator/verifier/VerificationRunner.ts
  src/orchestrator/router/TaskRouter.ts

保留:
  src/orchestrator/context/ContextBundleBuilder.ts
  src/orchestrator/index.ts (更新导出)
```

---

## 7. 实施步骤

1. 扩展 `OrchestratorModeConfig` 类型
2. 重写 `OrchestratorEngine`
3. 更新 `Task.initiateTaskLoop` 编排拦截
4. 更新编排设置 UI
5. 删除旧文件
6. 验证