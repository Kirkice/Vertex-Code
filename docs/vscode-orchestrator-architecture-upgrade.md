# 编排器架构升级设计文档

> 本文档描述 Vertex Code 编排器（Orchestrator）从"幕后单次调用"升级为"可见团队协作"的完整设计方案。
> 用于指导后续开发和代码审查。

## 1. 背景与目标

### 1.1 当前架构（升级前）

编排器有三个角色：**计划者（Planner）**、**执行者（Worker）**、**审核者（Reviewer）**。

```
用户发消息 → 编排模式开关 → OrchestratorSessionManager.startSession()
  ↓
🧠 计划者（Qwen）
  - 调用方式：completePrompt() 单次调用
  - 输出：结构化 JSON（PlanResponsePayload）
  - 可见性：❌ 用户不可见
  ↓
📋 编排面板显示任务列表 → 用户审批
  ↓
⚡ 执行者（DeepSeek）
  - 调用方式：createTask() 完整 agent 循环
  - 可见性：✅ 聊天窗口可见
  ↓
🔍 审核者（Qwen）
  - 调用方式：completePrompt() 单次调用
  - 输出：结构化 JSON（ReviewResponsePayload）
  - 可见性：❌ 用户不可见
  ↓
完成 / 修复循环
```

**问题：**
1. 计划者和审核者的对话不可见，用户不知道 Qwen 在做什么
2. 所有请求都走"规划→执行→审核"全流程，简单问题（如"解释一下这段代码"）也要拆解任务
3. 审核者过于严格，代码风格问题也会打回重做

### 1.2 目标架构（升级后）

将编排器改造为**可见的团队协作模式**：

```
用户发消息 → 编排模式开关 → OrchestratorSessionManager.startSession()
  ↓
🧠 计划者（Qwen）— 可见对话
  ├─ 简单请求 → [DIRECT] 直接回答 → 显示在聊天窗口 → 完成
  └─ 复杂任务 → [PLAN] 输出方案 → 等待用户审批
        ↓
⚡ 执行者（DeepSeek）— 可见对话
  按照方案执行，调用工具、读写文件
        ↓
🔍 审核者（Qwen）— 可见对话
  ├─ 核心功能OK → 通过 + 💡 建议列表（非阻塞）
  └─ 有功能缺陷 → 打回修复 → 回到执行者
```

**设计原则：**
- **计划者像主程**：判断任务复杂度，简单问题直接回答，复杂问题才分工
- **执行者像程序员**：按照方案执行具体编码工作
- **审核者像技术 QA**：宽松审核，核心功能 OK 就通过，优化建议展示给用户自选

## 2. 组件详细设计

### 2.1 计划者（Planner）

#### 文件位置
- Prompt：`src/orchestrator/planner/planner-prompts.ts`
- 逻辑：`src/orchestrator/planner/CodexPlanner.ts`

#### 输出格式

计划者根据任务复杂度输出不同格式：

**简单任务 — `[DIRECT]` 前缀：**
```
[DIRECT]
你的自然语言回答。直接回答问题、提供解释、或完成简单任务。
```

**复杂任务 — `[PLAN]` 前缀：**
```json
[PLAN]
{
  "planSummary": "计划摘要",
  "assumptions": ["假设条件"],
  "risks": ["风险点"],
  "tasks": [...],
  "finalReviewTemplate": {...}
}
```

#### 判断标准（写在 prompt 中）

| 类型 | 场景 | 输出 |
|------|------|------|
| 简单 | 问答、解释、概念讨论 | `[DIRECT]` |
| 简单 | 单文件小改动（修 typo、改变量名） | `[DIRECT]` |
| 简单 | 不需要工具调用的请求 | `[DIRECT]` |
| 复杂 | 多步骤编码任务 | `[PLAN]` |
| 复杂 | 需要设计决策的功能实现 | `[PLAN]` |
| 复杂 | 跨文件 Bug 调查 | `[PLAN]` |
| 复杂 | 多模块重构 | `[PLAN]` |

**兜底规则**：拿不准时优先选 `[DIRECT]`，避免过度拆分。

#### 解析逻辑（CodexPlanner.parsePlanResponse）

```typescript
type PlannerResult =
  | { type: "direct"; text: string }
  | { type: "plan"; plan: PlanResponsePayload; rawResponse: string }

function parsePlanResponse(responseText: string): PlannerResult {
  const trimmed = responseText.trim()

  // Case 1: [DIRECT] 前缀 → 直接回答
  if (trimmed.startsWith("[DIRECT]")) {
    return { type: "direct", text: trimmed.slice(8).trim() }
  }

  // Case 2: [PLAN] 前缀 → 解析 JSON 计划
  if (trimmed.startsWith("[PLAN]")) {
    const plan = parsePlanJson(trimmed.slice(6).trim())
    return { type: "plan", plan, rawResponse: responseText }
  }

  // Case 3: 无前缀但包含 JSON → 兼容旧格式，当作计划
  if (trimmed.match(/```json/) || trimmed.match(/\{[\s\S]*\}/)) {
    return { type: "plan", plan: parsePlanJson(trimmed), rawResponse: responseText }
  }

  // Case 4: 纯文本 → 当作直接回答
  return { type: "direct", text: trimmed }
}
```

#### 已实现状态：✅ 完成

### 2.2 执行者（Worker）

执行者通过 `createTask()` 启动完整的 agent 循环，调用工具、读写文件、执行命令。

**当前状态**：已经是可见的，无需改动。

**未来改进**：
- 在执行者消息旁显示 `⚡ 执行者` 标签
- 显示当前执行的是哪个任务（title）
- 显示使用的模型（DeepSeek）

### 2.3 审核者（Reviewer）

#### 文件位置
- Prompt：`src/orchestrator/reviewer/reviewer-prompts.ts`
- 逻辑：`src/orchestrator/reviewer/CodexReviewer.ts`

#### 审核策略：宽松通过 + 建议展示

```
审核者（Qwen）的输出结构：

{
  "decision": "accept",          // accept | repair | reject | needs_user_confirmation
  "summary": "整体功能实现正确",
  "findings": [],                 // 只有真正的功能缺陷
  "suggestions": [                // 非阻塞优化建议
    "可以考虑添加输入校验",
    "建议提取公共方法减少重复代码"
  ],
  "repairTasks": [],
  "userConfirmationQuestion": null
}
```

#### 审核规则

| 行为 | 处理方式 |
|------|---------|
| 核心功能正确 | ✅ 通过（即使有风格问题） |
| 代码风格/命名 | 💡 放入 suggestions，不阻塞 |
| 性能优化建议 | 💡 放入 suggestions，不阻塞 |
| 缺少测试覆盖 | 💡 放入 suggestions，不阻塞 |
| 代码不编译/不运行 | ❌ 打回修复 |
| 核心验收标准未满足 | ❌ 打回修复 |
| 逻辑错误导致结果错误 | ❌ 打回修复 |
| 安全漏洞/数据丢失风险 | ❌ 打回修复 |

**兜底规则**：拿不准时通过，将疑虑放入 suggestions。

#### 类型定义

```typescript
// packages/types/src/orchestrator-events.ts
interface ReviewResponsePayload {
  type: "review.response"
  decision: ReviewDecision
  summary: string
  findings: ReviewFinding[]
  suggestions?: string[]          // 新增：非阻塞建议
  repairTasks?: ExecTask[]
  userConfirmationQuestion?: string
}
```

#### 已实现状态：✅ 完成

### 2.4 编排会话管理器（SessionManager）

#### 文件位置
`src/orchestrator/session/OrchestratorSessionManager.ts`

#### 流程控制

```typescript
async runPlanningPhase(session: OrchestratorSession): Promise<void> {
  session.transitionTo("planning", "Starting planning phase")

  const context = await buildMinimalContext(...)
  session.setContextBundle(context)

  const result = await this.planner.plan(session.userRequest, context)

  if (result.type === "direct") {
    // 简单任务：直接回答，立即完成
    session.setDirectResponse(result.text)
    this.emit("plannerDirectResponse", session.sessionId, result.text)
    session.complete("Planner handled directly")
    this.emit("sessionCompleted", session.sessionId, "Direct response")
  } else {
    // 复杂任务：设置计划，等待审批
    session.setPlan(result.plan)
    for (const task of result.plan.tasks) {
      session.registerTask({ ...task, sessionId: session.sessionId })
    }
    this.emit("sessionStateChanged", session.sessionId, session.state)
  }
}
```

#### 已实现状态：✅ 完成

### 2.5 Bridge（消息路由）

#### 文件位置
`src/core/webview/orchestratorBridge.ts`

#### 事件转发

```typescript
// 直接回答 → 推送到前端
this.sessionManager.on("plannerDirectResponse", async (sessionId, text) => {
  await this.provider.postMessageToWebview({
    type: "orchestratorSessionUpdate",
    payload: {
      orchestratorSession: {
        sessionId,
        state: "completed",
        currentPhase: "planner_direct",
        directResponse: text,
        // ...
      }
    }
  })
})
```

#### 已实现状态：✅ 完成

### 2.6 前端面板（OrchestratorSessionPanel）

#### 文件位置
`webview-ui/src/components/orchestrator/OrchestratorSessionPanel.tsx`

#### 新增展示区域

| 区域 | 触发条件 | 展示内容 |
|------|---------|---------|
| 🧠 计划者回答 | `session.directResponse` 存在 | 直接回答的文本 |
| 🔍 审核结果 | `session.reviewSummary` 存在 | 审核摘要 + findings 列表 |
| 💡 建议 | `session.reviewSuggestions` 存在 | 可折叠建议列表 |

#### 已实现状态：✅ 完成

## 3. 已完成的工作清单

| # | 改动 | 文件 | 状态 |
|---|------|------|------|
| 1 | Planner prompt 支持 [DIRECT]/[PLAN] | `planner-prompts.ts` | ✅ |
| 2 | PlannerResult 类型 + 4 种解析兜底 | `CodexPlanner.ts` | ✅ |
| 3 | Session directResponse 存储 | `OrchestratorSession.ts` | ✅ |
| 4 | runPlanningPhase 分流逻辑 | `OrchestratorSessionManager.ts` | ✅ |
| 5 | plannerDirectResponse 事件转发 | `orchestratorBridge.ts` | ✅ |
| 6 | Reviewer prompt 宽松审核 + suggestions | `reviewer-prompts.ts` | ✅ |
| 7 | Reviewer 解析 suggestions 字段 | `CodexReviewer.ts` | ✅ |
| 8 | Reviewer completePrompt 补系统提示词 | `CodexReviewer.ts` | ✅ |
| 9 | ReviewResponsePayload 添加 suggestions | `orchestrator-events.ts` | ✅ |
| 10 | 前端面板：直接回答展示 | `OrchestratorSessionPanel.tsx` | ✅ |
| 11 | 前端面板：审核结果 + 建议折叠 | `OrchestratorSessionPanel.tsx` | ✅ |
| 12 | 前端面板：角色图标（🧠🔍） | `OrchestratorSessionPanel.tsx` | ✅ |
| 13 | Planner completePrompt 补系统提示词 | `CodexPlanner.ts` | ✅ |

## 4. 待完成的工作

### 4.1 审核者输出可见化（高优先级）

**目标**：审核者的 review 结果在聊天窗口中可见（不仅是编排面板）。

**方案**：
- 在 `OrchestratorSessionManager.ts` 的审核阶段，将 review 结果作为消息推送到聊天窗口
- 显示审核者摘要、findings 和 suggestions
- suggestions 作为可折叠区域

### 4.2 执行者任务进度可见化（中优先级）

**目标**：在执行阶段，用户能看到当前执行到哪个任务。

**方案**：
- 在 `OrchestratorSessionManager.ts` 的执行循环中，每个任务开始前推送进度
- 前端显示"正在执行：任务 2/5 — 实现用户认证"

### 4.3 ChatRow 角色标签（中优先级）

**目标**：在聊天消息中显示是哪个角色产生的（🧠 计划者 / ⚡ 执行者 / 🔍 审核者）。

**方案**：
- 在 `ClineMessage` 中添加可选字段 `orchestratorRole?: "planner" | "worker" | "reviewer"`
- 在 `ChatRow.tsx` 中根据此字段显示对应图标和颜色

### 4.4 构建验证（高优先级）

**目标**：确保所有改动后项目能正常编译。

**方案**：
```bash
# 验证类型包
npx tsc --noEmit -p packages/types/tsconfig.json

# 验证主项目
npx tsc --noEmit -p src/tsconfig.json

# 验证前端
cd webview-ui && npx tsc --noEmit
```

## 5. 文件改动索引

### 源码文件

| 文件 | 改动类型 |
|------|---------|
| `src/orchestrator/planner/planner-prompts.ts` | Prompt 重写 |
| `src/orchestrator/planner/CodexPlanner.ts` | PlannerResult 类型 + 解析逻辑 |
| `src/orchestrator/reviewer/reviewer-prompts.ts` | Prompt 重写（宽松审核） |
| `src/orchestrator/reviewer/CodexReviewer.ts` | suggestions 解析 + completePrompt 修复 |
| `src/orchestrator/session/OrchestratorSession.ts` | directResponse 存储 |
| `src/orchestrator/session/OrchestratorSessionManager.ts` | 分流逻辑 + 事件 |
| `src/core/webview/orchestratorBridge.ts` | 事件转发 + directResponse 推送 |

### 类型文件

| 文件 | 改动类型 |
|------|---------|
| `packages/types/src/orchestrator-events.ts` | ReviewResponsePayload 添加 suggestions |
| `packages/types/src/vscode-extension-host.ts` | ClineApiReqInfo 添加 modelId |

### 前端文件

| 文件 | 改动类型 |
|------|---------|
| `webview-ui/src/components/orchestrator/OrchestratorSessionPanel.tsx` | 新增多个展示区域 |

### 任务核心文件

| 文件 | 改动类型 |
|------|---------|
| `src/core/task/Task.ts` | api_req_started 写入 modelId |

## 6. 测试要点

### 6.1 计划者分流测试

| 输入 | 期望输出 |
|------|---------|
| "解释一下这段代码的作用" | `[DIRECT]` 直接回答 |
| "帮我在 utils 文件夹下添加一个 formatDate 函数" | `[DIRECT]` 或 `[PLAN]`（单文件，倾向 DIRECT） |
| "实现一个完整的用户认证系统，包括登录、注册、JWT token 刷新" | `[PLAN]` 多步骤计划 |
| "这个 bug 怎么修复：点击按钮没反应" | `[PLAN]`（需要调查） |

### 6.2 审核者宽松度测试

| 场景 | 期望决策 |
|------|---------|
| 功能正确但代码风格不佳 | `accept` + suggestions |
| 功能正确但缺少单元测试 | `accept` + suggestions |
| 功能正确但有更好的实现方式 | `accept` + suggestions |
| 代码无法编译 | `repair` |
| 核心功能未实现 | `repair` |
| 实现了完全无关的功能 | `reject` |

### 6.3 端到端测试

1. 开启编排模式，发送简单问题 → 应看到计划者直接回答
2. 开启编排模式，发送复杂编码任务 → 应看到计划方案，审批后执行者执行，最后审核通过
3. 关闭编排模式 → 行为不变（走原有流程）

## 7. 注意事项

1. **向后兼容**：旧的编排会话数据（没有 `[DIRECT]`/`[PLAN]` 前缀）仍可正常解析
2. **模型选择**：计划者和审核者使用 `codexProviderSettings`（当前 API 配置），执行者使用路由策略选择的模型
3. **completePrompt 限制**：`completePrompt` 是单次调用，不支持多轮对话。计划者和审核者的"可见化"目前通过编排面板实现，而非完整 agent 循环
4. **性能考虑**：`[DIRECT]` 路径比完整编排流程快得多（只需一次 API 调用），简单任务不会浪费时间