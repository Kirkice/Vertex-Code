# Vertex Graphics Agent 实现方案（最终版）

## 1. 文档目标

本文档定义 Vertex 在图形渲染开发方向的最终实现方案。

目标是把 Vertex 从通用代码 Agent 演进为一个面向以下场景的专业工作台：

- 游戏渲染开发
- GPU 开发
- 图形引擎开发
- Shader 开发与分析
- 帧调试与性能分析
- Capture 到工程代码的映射与排障

本文档是唯一生效版本，统一以下内容：

- 产品定位
- 架构边界
- Provider 抽象
- Graphics Mode
- 工作流设计
- 目录结构建议
- 代码落点建议
- 开发达成路径

## 2. 核心原则

### 2.1 Vertex 不强依赖任何单一工具

Vertex 不能强依赖：

- `renderdoc-for-vscode`
- 独立 `renderdoc mcp`
- 任意其他 graphics 工具 MCP

它们都只是同级的 graphics provider 实现。

Vertex 真正依赖的是：

- 图形 capture 能力接口
- 图形专项 workflow
- 图形专项 mode 语义

### 2.2 Provider 和 Workflow 必须解耦

Vertex 应拆成两层：

- Provider Layer：负责接外部图形工具能力
- Workflow Layer：负责组织分析逻辑

Workflow 不应知道：

- 具体 MCP server 名
- 具体工具名
- 具体产品名

Workflow 只应依赖统一的 provider 接口。

### 2.3 Graphics Mode 是正式产品能力

Graphics 不是一组 prompt 技巧，而是一个正式 Mode。

它的职责是：

- 切换到图形专项语境
- 优先启用图形专项 workflow
- 优先调用 graphics provider 能力
- 输出更适合渲染工程师的结构化结果

### 2.4 先能力抽象，再接具体工具

实现顺序必须是：

1. 定义 graphics provider 抽象
2. 定义 graphics workflow 编排
3. 定义 Graphics Mode
4. 再接入一个或多个同级 provider

而不是反过来先围绕某一个工具写死实现。

## 3. 产品定位

Vertex 的定位应为：

`Graphics-aware Engineering Agent inside VS Code`

它和通用 Agent 的区别不在“能不能写代码”，而在于它能：

- 理解当前 capture
- 理解当前 draw / pass / pipeline / shader / resource
- 理解 GPU 性能问题的分析路径
- 把 capture 事实映射回项目中的引擎代码与 shader 实现
- 给出更贴近图形工程现场的结论与下一步建议

## 4. 目标用户场景

Vertex Graphics Agent 主要服务这些场景：

### 4.1 帧分析

例如：

- 为什么这一帧这么慢
- 当前 capture 的主要 pass 是什么
- 哪几个 draw 最值得优先看

### 4.2 当前 draw 分析

例如：

- 当前选中的 draw 在做什么
- 为什么这个 draw 很贵
- 它更像几何压力还是像素压力

### 4.3 Shader / Pipeline 分析

例如：

- 这个 fragment shader 为什么开销高
- 当前 pipeline state 是否可疑
- 哪些绑定资源可能造成压力

### 4.4 Capture 到工程代码映射

例如：

- 这个 pass 在项目里由哪段代码负责
- 这个 shader 是哪边生成或绑定的
- 这个 draw 所属的引擎路径在哪里

### 4.5 图形专项排障

例如：

- 黑屏
- 阴影异常
- TAA ghosting
- 资源绑定错误
- GPU 帧耗异常

### 4.6 回归分析

例如：

- 为什么这个版本比之前慢
- 两个 capture 的热点差异在哪里
- 某个 shader / pipeline 改动是否导致回归

## 5. 总体架构

推荐采用四层架构。

### 5.1 Capability Layer

由外部 graphics provider 提供原始能力与事实。

典型能力包括：

- 打开当前 capture
- 获取 frame summary
- 获取 selection context
- 获取 event details
- 获取 pipeline state
- 获取 shader info / source
- 获取 mesh data
- 获取 resource detail
- 获取 texture / buffer 数据
- 获取 pass graph
- 查找项目实现

### 5.2 Provider Layer

Vertex 内部通过 provider 抽象统一接入各种 graphics MCP / bridge。

这一层负责：

- provider 注册
- provider 发现
- capability 检测
- 错误归一化
- 调用适配

### 5.3 Workflow Layer

Vertex 内部的图形分析工作流层。

这一层负责：

- 根据用户意图选择 workflow
- 根据 provider capabilities 决定调用路径
- 组织多步分析
- 对 facts 进行结构化整理

### 5.4 Experience Layer

Vertex 前端与 mode 体验层。

这一层负责：

- Graphics Mode
- Graphics Workspace
- 快捷入口
- 结构化结果展示
- provider 选择与提示

## 6. Provider 设计

## 6.1 Provider 的定位

Provider 是“外部图形能力接入单元”。

它不是某个产品名，而是一个抽象角色。

例如这些都应作为同级 provider：

- `renderdoc-for-vscode` 暴露的 MCP
- 独立 `renderdoc mcp`
- 团队内部 graphics capture MCP
- 其他 GPU / shader / capture 工具 MCP

## 6.2 Provider 接口

建议定义统一接口：

```ts
export interface GraphicsCaptureProvider {
  readonly id: string
  readonly displayName: string
  readonly kind: "mcp" | "extension-bridge" | "hybrid"

  isAvailable(): Promise<boolean>
  getCapabilities(): Promise<GraphicsProviderCapabilities>

  openCurrentCapture(): Promise<OpenCaptureResult>
  getFrameSummary(): Promise<FrameSummaryResult>
  getSelectionContext(): Promise<SelectionContextResult>
  getEventDetails(eventId: string | number): Promise<EventDetailsResult>
  getPipelineState(eventId: string | number): Promise<PipelineStateResult>
  getShaderInfo(input: ShaderInfoRequest): Promise<ShaderInfoResult>
  findProjectImplementation(input: ProjectMappingRequest): Promise<ProjectMappingResult>
}
```

## 6.3 Capability 描述

不同 provider 的能力不一定完整一致，因此必须显式声明 capabilities。

```ts
export interface GraphicsProviderCapabilities {
  frameSummary: boolean
  selectionContext: boolean
  eventDetails: boolean
  pipelineState: boolean
  shaderInfo: boolean
  shaderSource: boolean
  meshData: boolean
  resourceDetail: boolean
  textureData: boolean
  bufferData: boolean
  passGraph: boolean
  projectMapping: boolean
  captureDiff: boolean
}
```

## 6.4 Provider Registry

建议由 registry 统一管理 provider：

```ts
export interface GraphicsProviderRegistry {
  listProviders(): Promise<GraphicsCaptureProvider[]>
  getAvailableProviders(): Promise<GraphicsCaptureProvider[]>
  getSelectedProvider(): Promise<GraphicsCaptureProvider | null>
  getAutoMatchProviders(required: Partial<GraphicsProviderCapabilities>): Promise<GraphicsCaptureProvider[]>
  getProviderById(id: string): Promise<GraphicsCaptureProvider | null>
}
```

行为建议：

- 不设默认 provider
- 优先使用用户明确选择的 provider
- 未选择时，根据 workflow 所需 capability 给出候选 provider
- 如果能力不足，允许降级执行或提示切换 provider

### 6.5 单 Provider per Session 约束

第一阶段明确限制：

- 一次分析会话只使用一个 provider
- 不支持跨 provider 聚合（如 A 提供 frame summary，B 提供 shader info）

原因：

- 降低复杂度
- 避免状态不一致
- 便于调试和问题定位

Phase 5 可放开多 provider 聚合能力。

## 7. Graphics Mode 设计

## 7.1 为什么需要单独的 Mode

单纯加图形工具还不够，因为图形问题不仅是“调用哪个工具”，还涉及：

- 分析语境
- 输出结构
- 证据优先级
- 术语体系
- 行动建议的粒度

所以需要一个正式的 `Graphics` Mode。

## 7.2 Graphics Mode 的职责

- 使用图形专项 prompt
- 优先启用图形专项 workflow
- 优先调用 graphics provider
- 采用适合图形工程师的回答格式

## 7.3 进入方式

建议支持三种进入方式：

### A. 手动切换

用户明确切到 `Graphics` Mode。

### B. 本轮建议切换

检测到高置信图形意图时提示用户：

- 是否以 Graphics 模式处理本轮任务

### C. 本轮临时切换

高置信图形意图下，只对当前任务临时进入 Graphics 语义，不改变长期默认 mode。

推荐第一阶段优先做：

- 手动切换
- 本轮临时切换

## 7.4 退出策略

Graphics Mode 需要明确的退出机制：

### A. 手动退出

用户主动切回通用 Mode（如 Code / Ask）。

### B. 自动建议退出

当连续 3 轮对话未命中图形意图时，提示用户：

- 是否切回通用模式

### C. 会话重置

会话结束或新建会话时，Mode 重置为用户默认 Mode。

### D. 第一版约束

第一阶段只实现手动退出和会话重置，自动建议退出可后续补充。

## 7.5 触发信号

高置信关键词可以包括：

- `renderdoc`
- `capture`
- `frame analysis`
- `draw call`
- `eid`
- `shader`
- `pipeline`
- `render target`
- `descriptor`
- `resource binding`
- `gpu timing`
- `pass`
- `overdraw`
- `barrier`
- `vulkan`
- `d3d12`
- `black screen`
- `shadow issue`
- `ghosting`

## 7.5 输出格式建议

Graphics Mode 下建议优先输出：

1. 当前结论
2. 证据来源
3. 疑似瓶颈或可疑点
4. 可能原因
5. 下一步建议
6. 若可映射，则给出工程落点

## 8. Workflow 设计

## 8.1 图形意图分类

建议识别以下 intent：

- `frame_summary`
- `frame_performance`
- `selected_draw_explain`
- `shader_analysis`
- `pipeline_analysis`
- `resource_trace`
- `project_mapping`
- `regression_compare`
- `graphics_playbook`

## 8.2 Workflow Capability Preflight

每个 workflow 应在模块头部声明所需 provider capabilities。Orchestrator 在启动 workflow 前做 preflight check：

- 如果当前 provider 满足所有 required capabilities，正常执行
- 如果缺少部分 capability，尝试降级执行（跳过依赖该能力的步骤）
- 如果缺少关键 capability，提示用户切换 provider

示例：

```ts
// analyzeCurrentFrame.ts
export const requiredCapabilities: Partial<GraphicsProviderCapabilities> = {
  frameSummary: true,
  passGraph: true,
}
```

## 8.3 核心 Workflow

### A. Analyze Current Frame

输入：

- “分析当前帧”
- “为什么这一帧这么慢”

建议步骤：

1. `openCurrentCapture`
2. `getFrameSummary`
3. `getPassGraph`
4. `getActionTimings`
5. 对热点事件补充 `getEventDetails`

输出：

- 顶层 pass 摘要
- 热点事件
- 疑似瓶颈方向
- 下一步建议

### B. Explain Selected Draw

输入：

- “解释当前 draw”
- “为什么这个 draw 很贵”

建议步骤：

1. `getSelectionContext`
2. `getEventDetails`
3. `getPipelineState`
4. `getShaderInfo`
5. 必要时 `getMeshData`

输出：

- draw 作用说明
- 几何/像素压力初步判断
- shader stage 摘要
- 当前绑定摘要

### C. Find Owner In Project

输入：

- “这个 pass 对应哪段代码”
- “这个 shader 在项目里哪里实现”

建议步骤：

1. `getSelectionContext` 或接收显式对象
2. `findProjectImplementation`
3. 再结合 Vertex 本地搜索补强

输出：

- 候选代码文件
- 入口函数或相关路径
- 推荐继续查看的相邻实现

### D. Run Graphics Playbook

用于沉淀固定套路：

- 黑屏
- GPU 慢
- shader 过重
- 阴影问题

### E. Regression Compare

用于后续扩展：

- event diff
- pipeline diff
- shader diff
- capture 对比

## 9. 前端体验设计

## 9.1 Graphics Workspace

建议在 Vertex 前端中增加一个图形专项工作区。

第一阶段不一定要新增顶层 tab，也可以先在现有 Chat 体系内加入 `Graphics Workspace` 区域。

推荐内容：

- `Analyze Current Frame`
- `Explain Selected Draw`
- `Find Owner In Project`
- `Run Playbook`

## 9.2 结果卡片

建议至少拆成这些卡片：

- `FrameTriageCard`
- `SelectedDrawInsightCard`
- `ProjectMappingCard`
- `GraphicsPlaybooksPanel`

## 9.3 Provider 可见性

用户应能看见：

- 当前选中的 graphics provider
- 当前 provider 是否在线
- 当前 provider 是否支持本次 workflow 所需能力

## 10. 目录结构建议

## 10.1 后端

```text
src/
  services/
    graphics-provider/
      GraphicsCaptureProvider.ts
      GraphicsProviderRegistry.ts
      GraphicsProviderTypes.ts
      GraphicsProviderError.ts
      providers/
        renderdoc-vscode-mcp/
          RenderDocVsCodeMcpProvider.ts
          RenderDocVsCodeMcpSchemas.ts
          RenderDocVsCodeMcpAvailability.ts
        renderdoc-standalone-mcp/
          RenderDocStandaloneMcpProvider.ts
          RenderDocStandaloneMcpSchemas.ts
          RenderDocStandaloneMcpAvailability.ts
        custom-graphics-mcp/
          CustomGraphicsMcpProvider.ts
          CustomGraphicsMcpSchemas.ts
          CustomGraphicsMcpAvailability.ts
      __tests__/

    graphics-agent/
      GraphicsIntentRouter.ts
      GraphicsWorkflowOrchestrator.ts
      GraphicsAnswerFormatter.ts
      GraphicsTypes.ts
      workflows/
        analyzeCurrentFrame.ts
        explainSelectedDraw.ts
        findOwnerInProject.ts
        compareHotEvents.ts
        runGraphicsPlaybook.ts
      playbooks/
        blackScreen.ts
        gpuSlow.ts
        heavyShader.ts
      __tests__/
```

## 10.2 前端

```text
webview-ui/
  src/
    components/
      graphics/
        GraphicsWorkspace.tsx
        FrameTriageCard.tsx
        SelectedDrawInsightCard.tsx
        ProjectMappingCard.tsx
        GraphicsPlaybooksPanel.tsx
        GraphicsQuickActions.tsx
        __tests__/
    hooks/
      useGraphicsActions.ts
    types/
      graphics.ts
```

## 10.3 共享类型

可选：

```text
packages/
  types/
    src/
      graphics.ts
```

适合放这里的内容：

- `GraphicsIntent`
- `GraphicsPlaybookId`
- `GraphicsWorkflowResult`
- 前后端消息类型
- provider 选择相关类型

## 11. 具体代码落点

## 11.1 Provider 接入

建议落在：

- `src/services/mcp/`
- `src/services/graphics-provider/`

原因：

- MCP 访问能力已有基础
- provider 抽象属于 service 层，不属于 UI

建议新增：

- `src/services/graphics-provider/GraphicsCaptureProvider.ts`
- `src/services/graphics-provider/GraphicsProviderRegistry.ts`
- `src/services/graphics-provider/providers/...`

## 11.2 意图路由

建议新增：

- `src/services/graphics-agent/GraphicsIntentRouter.ts`

职责：

- 判断图形专项意图
- 决定是否触发 Graphics Mode
- 为 orchestrator 提供 intent

## 11.3 Workflow 编排

建议新增：

- `src/services/graphics-agent/GraphicsWorkflowOrchestrator.ts`

职责：

- 根据 intent 选择 workflow
- 根据 provider capabilities 调整流程
- 返回结构化结果

## 11.4 Webview 消息入口

建议落在：

- `src/core/webview/webviewMessageHandler.ts`

建议增加消息类型：

- `runGraphicsWorkflow`
- `runGraphicsPlaybook`
- `selectGraphicsProvider`

## 11.5 Provider 结果回传

建议落在：

- `src/core/webview/ClineProvider.ts`

职责：

- 缓存最近一次图形分析结果
- 发送 `graphicsResult` 到前端

注意：

- 不要把实际 workflow 逻辑塞进 `ClineProvider`

## 11.6 Prompt 与 Mode

建议落在：

- `packages/types/src/modes.ts`
- `src/shared/modes.ts`
- `src/core/prompts/sections/graphics-agent.ts`

职责：

- 注册 `Graphics` Mode
- 定义 Graphics mode 的 prompt 规则

## 11.7 前端显示

建议落在：

- `webview-ui/src/App.tsx`
- `webview-ui/src/components/graphics/...`

职责：

- 显示当前 Graphics Mode
- 展示 Graphics Workspace
- 展示结构化结果卡片

## 12. 开发任务清单

## 12.1 Phase 0：抽象定边界

目标：

- 确立 provider 抽象与 Graphics Mode 边界

任务：

1. 定义 `GraphicsCaptureProvider`
2. 定义 `GraphicsProviderCapabilities`
3. 定义 `GraphicsProviderRegistry`
4. 定义 `GraphicsIntent`
5. 定义 `Graphics` Mode 数据结构

完成标志：

- 后续所有图形逻辑都能围绕这些抽象展开

## 12.2 Phase 1：跑通最小链路

目标：

- 让 Vertex 能通过任意一个 graphics provider 跑通基础分析

任务：

1. 实现一个 provider adapter
2. 实现 provider availability 检测
3. 实现 `Analyze Current Frame`
4. 实现 `Explain Selected Draw`

完成标志：

- 已打开 capture 时，Vertex 能产出真实帧分析和 draw 分析结果

## 12.3 Phase 2：接入 Graphics Mode

目标：

- 为图形场景建立独立 mode 语义

任务：

1. 新增 `Graphics` Mode
2. 支持手动切换
3. 支持本轮临时切换
4. 增加 Graphics Mode prompt section

完成标志：

- 用户提图形问题时能进入正确语境

## 12.4 Phase 3：打通工程映射

目标：

- 从 capture 结果走到项目代码 owner

任务：

1. 实现 `Find Owner In Project`
2. 补强本地代码搜索
3. 增加可点击代码入口

完成标志：

- 用户可从热点 draw 快速定位项目实现

## 12.5 Phase 4：沉淀 Playbook

目标：

- 把常见图形问题沉淀为固定套路

任务：

1. 黑屏 playbook
2. GPU 慢 playbook
3. shader 过重 playbook
4. 阴影问题 playbook

完成标志：

- 用户可通过固定入口稳定复用分析流程

## 12.6 Phase 5：支持多 Provider

目标：

- 支持多个同级 graphics MCP 共存

任务：

1. 多 provider 注册
2. provider 选择 UI
3. capability 匹配与降级
4. 候选 provider 推荐

完成标志：

- 多个 provider 能在不修改 workflow 的前提下共存

## 12.7 Phase 6：回归分析与高级工作台

目标：

- 把 Vertex 做成常驻图形分析工作台

任务：

1. pipeline / shader / event diff
2. capture 对比
3. 更完整的 Graphics Workspace
4. 结果历史与复盘

完成标志：

- 用户能把 Vertex 当成图形专项工作台长期使用

## 13. 推荐的实际开工顺序

如果以“最快出效果 + 最少返工”为原则，建议按下面顺序推进：

1. `GraphicsCaptureProvider.ts`
2. `GraphicsProviderRegistry.ts`
3. `GraphicsProviderTypes.ts`
4. 一个 provider adapter
5. `GraphicsIntentRouter.ts`
6. `GraphicsWorkflowOrchestrator.ts`
7. `analyzeCurrentFrame.ts`
8. `explainSelectedDraw.ts`
9. `Graphics` Mode
10. `GraphicsWorkspace.tsx`
11. `findOwnerInProject.ts`
12. playbooks
13. 多 provider 管理
14. 回归分析

## 14. 第一批建议创建的文件

建议第一批就创建这些文件：

- `src/services/graphics-provider/GraphicsCaptureProvider.ts`
- `src/services/graphics-provider/GraphicsProviderRegistry.ts`
- `src/services/graphics-provider/GraphicsProviderTypes.ts`
- `src/services/graphics-provider/providers/renderdoc-vscode-mcp/RenderDocVsCodeMcpProvider.ts`
- `src/services/graphics-agent/GraphicsIntentRouter.ts`
- `src/services/graphics-agent/GraphicsWorkflowOrchestrator.ts`
- `src/services/graphics-agent/GraphicsAnswerFormatter.ts`
- `src/services/graphics-agent/workflows/analyzeCurrentFrame.ts`
- `src/services/graphics-agent/workflows/explainSelectedDraw.ts`
- `src/services/graphics-agent/workflows/findOwnerInProject.ts`
- `webview-ui/src/components/graphics/GraphicsWorkspace.tsx`
- `webview-ui/src/components/graphics/FrameTriageCard.tsx`
- `webview-ui/src/components/graphics/SelectedDrawInsightCard.tsx`

## 15. 成功标准

如果方案落地成功，用户应该明显感受到：

- 不需要先自己读一遍 capture 再问 AI
- 不需要在 RenderDoc、代码、终端、聊天窗口之间来回切换
- Vertex 能基于当前帧事实给出更可信的图形专项分析
- Vertex 能更快指出哪个 pass 慢、哪个 draw 热、哪个 shader 重
- Vertex 能更快把问题映射到项目中的责任代码
- Vertex 能接多个同级 graphics MCP，而不需要为每个工具重写整套 workflow

到这个阶段，Vertex 才真正成为一个面向图形渲染开发的专用 Agent 工作台。

