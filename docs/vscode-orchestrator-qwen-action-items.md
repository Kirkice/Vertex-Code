# VSCode Orchestrator 可用版收口清单

## 目标

本清单用于指导 qwen 将当前 Orchestrator 功能从“部分链路已实现”收口到“可用版”。

这里的“可用版”定义为：

- 用户可以在产品界面中明确开启 Orchestrator 模式
- 用户发起一次真实请求后，系统会真实创建 orchestrator session
- 用户可以看到 planning 状态、计划摘要和 Approve Plan 按钮
- 用户点击 Approve Plan 后，会进入真实执行链路，而不是 preview/skeleton 假结果
- 前端可以持续收到并展示执行中的状态变化
- 文档描述与实际代码行为一致

---

## 一、必须完成项

### 1. 接通真实 session 创建入口

#### 当前问题

- `OrchestratorBridge.startSession()` 已经存在
- 但当前产品代码中未确认存在真实调用入口
- 现在前端的 session 面板更像是“有 session 就展示”，而不是“用户请求会触发 session 创建”

#### 必须完成

- 在真实用户请求入口中接入 orchestrator 分流逻辑
- 当 `orchestratorEnabled === true` 时，不再走普通单模型流程，而是调用 `orchestratorBridge.startSession(...)`
- `startSession(...)` 需要接收到完整上下文：
  - 用户请求
  - 当前活动文件（如果有）
  - 当前选中文本（如果有）

#### 达标标准

- 用户开启 orchestrator 后，发送一条真实请求，能够创建一个新的 session
- 前端能立即收到 `orchestratorSessionUpdate`
- session 初始状态不是伪造数据，而是真实由 SessionManager 创建

---

### 2. 移除 preview/skeleton 假完成逻辑

#### 当前问题

`src/core/webview/orchestratorBridge.ts` 中仍存在这类逻辑：

- session 不存在时，记录 `preview mode`
- 然后直接向前端回发一个 `completed` 状态
- `currentPhase` 里写 `Preview mode - execution not yet implemented`

这会让用户误以为流程完成，但实际上没有执行。

#### 必须完成

- 删除 `approvePlan()` 中的 preview/skeleton fallback
- 当 session 不存在时，改成真实错误处理：
  - 记录错误日志
  - 向前端返回明确错误或失败状态
  - 不能伪造 completed 成功结果

#### 达标标准

- 点击 Approve Plan 时，如果 session 存在，就进入真实执行
- 如果 session 不存在，界面显示明确异常，不出现“假 completed”

---

### 3. 把 Orchestrator 开关真正挂到可见 UI

#### 当前问题

- `OrchestratorToggle` 组件已存在
- 协议字段 `bool` 也已经修正
- 但目前未确认它已经实际渲染到设置页或其他用户可见入口

#### 必须完成

- 将 `OrchestratorToggle` 接入真实设置页或用户入口
- 确保入口位置和文档描述一致
- 开关状态需要和全局状态双向同步

#### 达标标准

- 用户能在界面上看到“启用 Orchestrator 模式”开关
- 刷新 webview 后状态仍能正确回显
- 开关切换后，后续请求的路由行为会立即变化

---

### 4. 打通完整产品链路

#### 目标链路

1. 用户开启 orchestrator
2. 用户发起请求
3. extension 侧创建 session
4. SessionManager 进入 `planning`
5. 前端展示 plan summary 和任务列表
6. 用户点击 `Approve Plan`
7. 系统进入 `executing`
8. 执行完成后进入 `reviewing`
9. 最终进入 `completed` / `failed` / `cancelled`

#### 必须完成

- 把上述链路全部打通
- 任意一步都不能依赖“假数据完成”
- 所有状态变化都要有前后端消息同步

#### 达标标准

- 用一次真实请求可以跑完整条流程
- 不需要开发者手工注入 session 或手工改状态

---

### 5. 确认前端状态展示完整可用

#### 必须完成

- 校验前端能够正确展示以下状态：
  - `planning`
  - `executing`
  - `reviewing`
  - `repairing`
  - `completed`
  - `failed`
  - `cancelled`
- 校验以下信息会跟随 session 更新：
  - `currentPhase`
  - `tasks`
  - `planSummary`
  - `repairRound`
  - `costStats`

#### 达标标准

- 用户能在面板中看到连续状态变化
- 不会出现状态卡死、按钮错位、信息不刷新

---

### 6. 文档口径必须与代码一致

#### 当前问题

当前两份文档已经比之前好很多，但仍然可能高估能力边界。

#### 必须完成

- 如果代码已经补齐为可用版，就把文档改成准确描述“真实可用链路”
- 如果某些能力仍是 mock，需要明确写清边界
- 文档中不得再出现与实际实现冲突的说法

#### 达标标准

- 文档中的“可用版”表述与真实行为一致
- 不再出现“文档说已接通，代码仍是 preview fallback”的冲突

---

## 二、建议完成项

### 1. 给启动入口增加显式日志

建议在以下节点补充日志，便于排查：

- orchestrator enabled 分流命中
- startSession 被调用
- sessionId 创建成功
- planning 完成
- approvePlan 被触发
- executing 开始
- reviewing 开始
- completed / failed / cancelled

这样后续验收时能快速判断卡在哪一段。

---

### 2. 给 session 不存在场景增加用户可见错误提示

除了日志，建议前端也展示简短错误信息，例如：

- `Orchestrator session not found`
- `Please retry the request`

避免用户点击按钮后无反馈。

---

### 3. 增加最小可用版埋点或调试开关

如果后面还要继续接真实 Planner / Worker / Reviewer，建议保留一个轻量调试模式，便于快速确认：

- 当前是否走了 orchestrator 路由
- 当前 sessionId 是什么
- 当前状态机走到哪一步

---

## 三、必须补的测试

### 1. 产品链路集成测试

至少补一条覆盖以下路径的集成测试：

1. 开启 orchestrator
2. 发起用户请求
3. 创建 session
4. 进入 `planning`
5. 调用 `approvePlan`
6. 进入 `executing`
7. 进入 `reviewing`
8. 最终进入终态

#### 验收要求

- 测试不能只停留在 `SessionManager.startSession()`
- 必须覆盖 webview/extension 层的真实串联

---

### 2. session 缺失错误测试

补一条测试验证：

- Approve Plan 时如果 session 不存在
- 系统不会伪造 `completed`
- 会返回明确错误或失败路径

---

### 3. 开关行为测试

补一条测试验证：

- `orchestratorEnabled=false` 时走原始默认流程
- `orchestratorEnabled=true` 时走 orchestrator 流程

---

## 四、自测清单

qwen 提交前，需要自己按下面步骤完整自测一遍：

1. 打开设置页，确认能看到 Orchestrator 开关
2. 切换开关后，刷新界面，确认状态回显正确
3. 在开启状态下发送一条真实请求
4. 确认前端出现新的 orchestrator session 面板
5. 确认 session 首先进入 `planning`
6. 确认显示任务列表和计划摘要
7. 点击 `Approve Plan`
8. 确认状态进入 `executing`
9. 确认之后进入 `reviewing`
10. 确认最终进入 `completed` / `failed`
11. 全流程中不出现 preview mode 文案
12. Approve Plan 过程中不出现“假 completed”

---

## 五、交付物要求

qwen 完成后，至少需要提交以下内容：

1. 代码改动
2. 更新后的文档
3. 新增或更新的测试
4. 一段自测结果说明，至少包含：
   - Orchestrator 开关入口在哪里
   - 如何触发 session 创建
   - Approve Plan 后的真实行为
   - 是否已移除 preview fallback
   - 跑通了一条什么样的示例请求

---

## 六、验收标准

只有同时满足以下条件，才可以认定为“可用版”：

- 有真实用户入口可以启用 orchestrator
- 有真实请求入口可以创建 session
- Approve Plan 后进入真实执行链路
- 不再存在 preview/skeleton 假完成兜底
- 前端能展示完整状态变化
- 文档与代码一致
- 至少有一条完整链路的自动化测试
- qwen 提供了自测结果

如果上述任一项缺失，则不应对外宣称“可用版”。
