# 多模型编排系统 - 开发变更记录

## 版本状态：功能可用版

本变更记录描述的是 Orchestrator 功能的**功能可用实现**。核心架构、类型系统、UI 组件、端到端执行链路均已完成。

### 实现完成度

| 类别 | 状态 | 说明 |
|------|------|------|
| 类型系统 | ✅ 完成 | 所有接口、类型定义已完成 |
| 状态机 | ✅ 完成 | 状态转换逻辑已实现 |
| UI 组件 | ✅ 完成 | 设置面板、会话面板、切换开关已完成 |
| 消息协议 | ✅ 完成 | 前后端消息类型已定义，字段命名已统一 |
| Session Manager | ✅ 完成 | 完整执行循环（execute → verify → review → repair） |
| OrchestratorBridge | ✅ 完成 | 连接 webview 消息与 SessionManager |
| 集成测试 | ✅ 完成 | 19 个测试用例全部通过 |
| Planner | ⚠️ Mock | 类已创建，返回固定 JSON 计划 |
| Worker | ⚠️ Mock | 类已创建，返回固定执行结果 |
| Verifier | ⚠️ Mock | 类已创建，返回固定验证通过结果 |
| Reviewer | ⚠️ Mock | 类已创建，返回固定审查通过结果 |

---

## 概述

本次开发为 Vertex Code VSCode 插件新增了**多模型编排（Orchestrator）**功能，建立了 Planner-Reviewer + Worker 的主从式多模型协作系统架构。核心理念是让高价值模型（如 Codex）负责规划和审查，低成本模型（如 DeepSeek、Qwen）负责具体执行，从而在保持质量的同时显著降低 API 成本。

**当前状态：** 功能可用版，端到端执行链路已接通，核心执行逻辑已实现，但 LLM 集成使用 mock 返回。

---

## 一、新增文件清单

### 1.1 类型系统 (`packages/types/src/`)

| 文件 | 说明 |
|------|------|
| `orchestrator.ts` | 核心类型定义：OrchestratorTask、ExecTask、ReviewTask、ContextBundle、VerificationReport、AcceptanceCriterion、TaskConstraint、ModelPreference 等 |
| `orchestrator-events.ts` | 消息协议与事件类型：MessageEnvelope、PlanRequestPayload、PlanResponsePayload、ExecuteTaskPayload、WorkerResultPayload、VerifyRequestPayload、ReviewRequestPayload、ReviewResponsePayload、OrchestratorWebviewPush 等 |
| `orchestrator-config.ts` | Provider 配置：OrchestratorProviderConfig、OrchestratorRoutingPolicy、OrchestratorWorkerProfiles、DEFAULT_ORCHESTRATOR_CONFIG、ORCHESTRATOR_MODES |

### 1.2 核心编排模块 (`src/orchestrator/`)

| 文件 | 说明 |
|------|------|
| `index.ts` | 模块主导出 |
| `protocol/index.ts` | 协议层 re-export（从 @roo-code/types 导出） |
| **Session 模块** | |
| `session/stateMachine.ts` | 状态机：created → planning → executing → verifying → reviewing → completed/failed/cancelled，支持 repair 循环 |
| `session/OrchestratorSession.ts` | 会话控制器：管理单次编排生命周期，协调各模块 |
| `session/OrchestratorSessionManager.ts` | 会话管理器：管理多个并发编排会话，实现完整执行循环 |
| `session/repairLoop.ts` | 修复循环逻辑：最多 N 轮，从 reviewer findings 生成 repair tasks |
| **Planner 模块** | |
| `planner/CodexPlanner.ts` | Codex 规划器：调用模型生成结构化 JSON 任务计划 |
| `planner/planner-prompts.ts` | 规划器 Prompt 模板（系统提示 + 用户提示 + 修复规划提示） |
| **Router 模块** | |
| `router/TaskRouter.ts` | 规则路由器：根据任务风险等级、文件数量、预算压力等选择执行模型 |
| **Context 模块** | |
| `context/ContextBundleBuilder.ts` | 上下文切片器：提取最小必要上下文，控制 token 成本 |
| **Verifier 模块** | |
| `verifier/VerificationRunner.ts` | 验证器：执行 lint/typecheck/test/build 命令，支持 fast/standard/full 三种验证级别 |
| **Reviewer 模块** | |
| `reviewer/CodexReviewer.ts` | Codex 审查器：审查执行结果，返回 accept/repair/reject/needs_user_confirmation |
| `reviewer/reviewer-prompts.ts` | 审查器 Prompt 模板 |
| **Worker 模块** | |
| `worker/ExecTaskRunner.ts` | 执行任务运行器：桥接编排系统与现有 Task 执行引擎 |
| `worker/worker-prompts.ts` | Worker Prompt 模板（系统提示 + 用户提示 + 修复提示） |

### 1.3 Bridge 层 (`src/core/webview/`)

| 文件 | 说明 |
|------|------|
| `orchestratorBridge.ts` | 连接 webview 消息与 OrchestratorSessionManager，转发事件到 UI |

### 1.4 Webview UI 组件 (`webview-ui/src/components/orchestrator/`)

| 文件 | 说明 |
|------|------|
| `index.ts` | 组件导出 |
| `OrchestratorToggle.tsx` | 模式切换开关（默认系统 ⇄ 多模型编排） |
| `OrchestratorSettings.tsx` | 编排设置面板：主模型/工作模型选择、路由策略配置 |
| `OrchestratorSessionPanel.tsx` | 编排会话状态面板：显示当前阶段、任务列表、修复轮次、成本统计 |

### 1.5 测试 (`src/orchestrator/__tests__/`)

| 文件 | 说明 |
|------|------|
| `orchestrator-workflow.integration.test.ts` | 集成测试：覆盖会话创建、计划审批、执行循环、取消、错误处理等 19 个测试用例 |

---

## 二、修改的文件清单

### 2.1 类型系统

| 文件 | 修改内容 |
|------|----------|
| `packages/types/src/index.ts` | 新增 `orchestrator.ts`、`orchestrator-events.ts`、`orchestrator-config.ts` 导出 |
| `packages/types/src/global-settings.ts` | `globalSettingsSchema` 新增 `orchestratorEnabled`、`orchestratorConfig`、`orchestratorSession` 字段 |
| `packages/types/src/vscode-extension-host.ts` | `ExtensionState` 新增 orchestrator 字段；`ExtensionMessage.type` 新增 4 种消息类型；`WebviewMessage.type` 新增 4 种消息类型；`WebviewMessage` 新增 `sessionId` 字段；新增 `OrchestratorSessionSnapshot` 接口 |

### 2.2 前端（Webview）

| 文件 | 修改内容 |
|------|----------|
| `webview-ui/tsconfig.json` | `types` 数组新增 `@testing-library/jest-dom`，修复测试类型错误 |
| `webview-ui/src/context/ExtensionStateContext.tsx` | 导入 orchestrator 类型；新增 orchestrator 状态和 setter |
| `webview-ui/src/components/settings/SettingsView.tsx` | `sectionNames` 新增 `"orchestrator"`；新增 orchestrator 面板渲染 |
| `webview-ui/src/components/chat/ChatView.tsx` | 导入 `OrchestratorSessionPanel`；在 `TaskHeader` 下方渲染编排会话面板 |
| `webview-ui/src/components/orchestrator/OrchestratorToggle.tsx` | 修复字段命名：`enabled` → `bool` |
| `webview-ui/src/components/orchestrator/OrchestratorSessionPanel.tsx` | 修复审批按钮显示条件：`reviewing` → `planning` |

### 2.3 国际化

| 文件 | 修改内容 |
|------|----------|
| `webview-ui/src/i18n/locales/en/common.json` | 新增 `orchestrator` 命名空间（40+ 条翻译） |
| `webview-ui/src/i18n/locales/zh-CN/common.json` | 新增 `orchestrator` 命名空间中文翻译 |
| `webview-ui/src/i18n/locales/en/settings.json` | `sections` 新增 `"orchestrator": "Orchestrator"` |
| `webview-ui/src/i18n/locales/zh-CN/settings.json` | `sections` 新增 `"orchestrator": "编排器"` |

### 2.4 后端（Extension Host）

| 文件 | 修改内容 |
|------|----------|
| `src/core/webview/webviewMessageHandler.ts` | 新增 4 个 orchestrator 消息处理 case；`orchestratorApprovePlan` 和 `orchestratorCancel` 连接真实 SessionManager 调用 |
| `src/core/webview/ClineProvider.ts` | 新增 `orchestratorBridge` 属性；导入 `OrchestratorBridge` |
| `src/orchestrator/session/OrchestratorSessionManager.ts` | 实现 `runExecutionLoop()`、`executeReadyTasks()`、`runReviewPhase()` 方法 |

---

## 三、架构设计

### 3.1 整体流程

```
用户请求
  → OrchestratorSessionManager 创建会话
  → ContextBundleBuilder 提取上下文
  → CodexPlanner 生成结构化任务计划
  → [用户审批计划]
  → TaskRouter 为每个 ExecTask 选择模型
  → ExecTaskRunner 执行任务（mock）
  → VerificationRunner 验证结果（mock）
  → CodexReviewer 审查结果（mock）
  → [通过] → 完成
  → [修复] → 生成修复任务 → 重新执行（最多 N 轮）
  → [拒绝] → 失败
```

### 3.2 状态机

```
created → planning → executing → verifying → reviewing → completed
                                                  ↓
                                             repairing → executing (循环)
                                                  ↓
                                               failed
```

### 3.3 模型分工

| 角色 | 推荐模型 | 职责 |
|------|----------|------|
| Planner | Codex / GPT-4 | 任务规划、分解、验收标准制定 |
| Worker | DeepSeek / Qwen | 代码执行、文件修改、测试编写 |
| Reviewer | Codex / GPT-4 | 代码审查、验收决策 |

### 3.4 消息流

```
Webview                    Extension Host                    Orchestrator
   │                              │                                │
   │ orchestratorSetEnabled       │                                │
   │─────────────────────────────>│                                │
   │                              │ updateGlobalState              │
   │                              │───────────────────────────────>│
   │                              │                                │
   │ orchestratorApprovePlan      │                                │
   │─────────────────────────────>│                                │
   │                              │ OrchestratorBridge.approvePlan │
   │                              │───────────────────────────────>│
   │                              │                                │ runExecutionLoop()
   │                              │                                │──────────┐
   │                              │                                │          │
   │ orchestratorSessionUpdate    │                                │          │
   │<─────────────────────────────│<───────────────────────────────│          │
   │                              │                                │<─────────┘
```

---

## 四、验收整改记录

### 整改日期：2026-06-09

根据 `vscode-orchestrator-acceptance-report.md` 的验收报告，完成以下整改：

| 优先级 | 问题 | 整改措施 | 状态 |
|--------|------|----------|------|
| P1 | 文档口径与实现不一致 | 更新 user-guide 和 changelog，准确描述功能状态 | ✅ 完成 |
| P2 | Toggle 开关字段命名不一致 | `OrchestratorToggle.tsx` 改为发送 `bool` 字段 | ✅ 完成 |
| P3 | approvePlan/cancel 为占位实现 | `webviewMessageHandler.ts` 连接真实 SessionManager 调用 | ✅ 完成 |
| P4 | 审批状态前后端不一致 | `OrchestratorSessionPanel.tsx` 改为 `planning` 状态显示按钮 | ✅ 完成 |
| P5 | 缺少集成测试 | 新增 `orchestrator-workflow.integration.test.ts`（19 个测试） | ✅ 完成 |

### 新增关键模块

| 模块 | 文件 | 说明 |
|------|------|------|
| OrchestratorBridge | `src/core/webview/orchestratorBridge.ts` | 连接 webview 消息与 SessionManager |
| 执行循环 | `OrchestratorSessionManager.runExecutionLoop()` | 完整 execute → verify → review 循环 |
| 消息处理 | `webviewMessageHandler.ts` 中的 orchestrator cases | 连接 UI 操作到后端逻辑 |

---

## 五、已知限制与后续工作

### 当前版本限制

1. **LLM 集成为 Mock**
   - CodexPlanner 使用 mock 返回，未接入真实 LLM API
   - ExecTaskRunner 使用 mock 返回，未创建真实 Task 实例
   - CodexReviewer 使用 mock 返回，未调用真实 LLM 审查
   - VerificationRunner 返回固定成功结果，未执行真实 lint/test 命令

2. **无持久化**
   - 会话状态仅保存在内存中，刷新后丢失

### 后续迭代方向

1. **接入真实 LLM API**
   - 将 CodexPlanner 连接到实际的 LLM provider
   - 将 CodexReviewer 连接到实际的 LLM provider
   - 将 ExecTaskRunner 连接到真实的 Task 执行系统

2. **实现真实验证**
   - VerificationRunner 执行真实的 lint/typecheck/test 命令
   - 收集诊断结果并格式化

3. **会话持久化**
   - 将会话状态保存到磁盘
   - 支持会话恢复和回放

4. **成本监控**
   - 实时统计每个阶段的 token 消耗
   - 按 provider 分类展示成本

---

*文档版本：v1.1*  
*最后更新：2026-06-09*