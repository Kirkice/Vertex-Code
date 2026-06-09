# Vertex Code Orchestrator 模式使用指南

## 版本状态：功能可用版

本文档描述的是 Orchestrator 模式的**功能可用版本**。

### 已实现功能
- ✅ 类型系统、状态机、配置 UI 已完成
- ✅ 设置页面可配置模型和路由策略
- ✅ 端到端执行链路已接通（OrchestratorBridge + SessionManager）
- ✅ Approve Plan 按钮已连接真实执行逻辑
- ✅ 支持修复轮次（最多 maxRepairRounds 轮）

### 已知限制
- ⚠️ Worker 使用 mock 实现（未创建真实 Task 实例）
- ⚠️ 会话状态无持久化（刷新后丢失）
- ⚠️ 成本监控待实现

---

## 1. 概述

Orchestrator 模式是 Vertex Code 的多模型编排功能，允许用户配置不同的 LLM Provider 用于不同角色的任务执行：

- **Planner**：负责任务规划和分解（推荐 Codex/GPT-4）
- **Worker**：负责代码实现（推荐 DeepSeek/Qwen）
- **Reviewer**：负责代码审查和验收（推荐 Codex/GPT-4）

通过合理配置，可以在保证质量的同时降低 API 调用成本。

---

## 2. 启用与配置

### 2.1 启用 Orchestrator 模式

1. 打开设置页面：`Ctrl+,` 或 `Cmd+,`
2. 搜索 "Orchestrator"
3. 开启 "启用 Orchestrator 模式" 开关

### 2.2 配置 Provider

在 Orchestrator 设置区域，配置以下三个角色：

| 角色 | 说明 | 推荐配置 |
|------|------|----------|
| Planner Profile | 任务规划模型 | Codex / GPT-4 |
| Worker Profile | 代码执行模型 | DeepSeek / Qwen |
| Reviewer Profile | 代码审查模型 | Codex / GPT-4 |

### 2.3 路由策略

- **Max Repair Rounds**：最大修复轮次（默认 2 轮）
- **Auto Review**：是否在 Worker 完成后自动调用 Reviewer（默认开启）

---

## 3. 工作流程

### 3.1 完整编排流程

```
用户输入
    ↓
[1] OrchestratorSessionManager 创建会话
    ↓
[2] Planner 生成任务计划
    ↓
[3] 用户审批计划 (Approve Plan)
    ↓
[4] 执行循环开始：
    ├── Worker 执行任务
    ├── Verifier 验证结果
    ├── Reviewer 审查代码
    │   ├── 接受 → 会话完成
    │   ├── 修复 → 回到 Worker（最多 N 轮）
    │   └── 拒绝 → 会话失败
    └── 循环直到完成或达到最大轮次
```

### 3.2 状态流转

会话状态按以下顺序流转：

```
created → planning → executing → verifying → reviewing → completed
                                                        → failed
                                                        → cancelled
```

---

## 4. UI 组件

### 4.1 OrchestratorToggle

设置页面中的切换开关，用于启用/禁用 Orchestrator 模式。开关位于设置页面的 "Orchestrator" 部分。

### 4.2 OrchestratorSettings

设置页面中的 Orchestrator 配置区域，包含：
- 三个角色的 Provider 选择
- 路由策略配置
- 模型参数调整

### 4.3 OrchestratorSessionPanel

在对话中显示的会话状态面板，展示：
- 当前阶段和进度
- 任务列表及状态
- 修复轮次计数
- 执行摘要

---

## 5. 消息协议

Orchestrator 使用以下消息类型与 Webview 通信：

| 消息类型 | 方向 | 说明 |
|----------|------|------|
| `orchestratorSetEnabled` | Webview → Extension | 启用/禁用 Orchestrator |
| `orchestratorApprovePlan` | Webview → Extension | 用户批准执行计划 |
| `orchestratorCancel` | Webview → Extension | 用户取消当前会话 |
| `orchestratorSessionUpdate` | Extension → Webview | 会话状态更新推送 |

---

## 6. 最佳实践

### 6.1 模型选择建议

- **Planner** 需要较强的推理和规划能力，建议使用高能力模型
- **Worker** 主要负责代码生成，可使用性价比更高的模型
- **Reviewer** 需要准确判断代码质量，建议使用与 Planner 相同的高能力模型

### 6.2 成本控制

- 合理设置 Max Repair Rounds，避免无限修复循环
- 对于简单任务，可关闭 Auto Review 以节省 Reviewer 调用
- 监控 Session Panel 中的轮次计数，及时调整配置

### 6.3 任务规划

- 提供清晰、具体的需求描述，帮助 Planner 生成更好的计划
- 仔细审查 Planner 生成的任务计划，确保理解每个步骤
- 如果计划不合理，可以取消后重新提交更明确的需求

---

## 7. 故障排查

### 7.1 常见问题

**Q: 启用 Orchestrator 后没有反应？**
A: 检查是否正确配置了三个角色的 Provider，确保每个 Provider 都有有效的 API Key。

**Q: Approve Plan 按钮点击后无响应？**
A: 查看输出面板（Output Panel）中的日志，确认 OrchestratorBridge 是否正确初始化。

**Q: 会话一直卡在某个状态？**
A: 可能是 Worker/Verifier/Reviewer 的 mock 实现导致。当前版本这些组件返回固定结果，真实 LLM 集成待后续实现。

### 7.2 日志查看

在 VS Code 的输出面板中选择 "Vertex Code" 通道，可查看 Orchestrator 相关的详细日志。

---

## 8. 后续开发计划

1. **真实 LLM 集成**：将 Worker/Verifier/Reviewer 连接到真实 LLM API
2. **会话持久化**：支持会话状态的保存和恢复
3. **成本监控**：实时显示各角色的 token 消耗和费用
4. **并行执行**：支持多个 Worker 任务的并行执行
5. **自定义 Prompt**：允许用户自定义各角色的系统提示词

---

*文档版本：v1.0*  
*最后更新：2026-06-09*