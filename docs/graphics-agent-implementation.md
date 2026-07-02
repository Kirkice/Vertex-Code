# Vertex Graphics Agent 实现文档

## 概述

本文档记录了 Vertex Graphics Agent 的完整实现，包括架构设计、文件结构、工作流程和集成方式。

Graphics Agent 将 Vertex 从通用代码 Agent 演进为面向图形渲染开发的专业工作台，支持帧分析、Draw Call 解释、Shader 性能排查、项目代码映射等功能。

---

## 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    Experience Layer                      │
│  GraphicsWorkspace / FrameTriageCard / SelectedDrawCard │
│  Graphics Mode (prompt + mode switching)                │
├─────────────────────────────────────────────────────────┤
│                    Workflow Layer                        │
│  GraphicsIntentRouter → GraphicsWorkflowOrchestrator    │
│  Workflows: analyzeFrame / explainDraw / findOwner     │
│  Playbooks: blackScreen / gpuSlow / heavyShader        │
├─────────────────────────────────────────────────────────┤
│                    Provider Layer                        │
│  GraphicsProviderRegistry (register / select / match)   │
│  GraphicsCaptureProvider (interface)                    │
│  RenderDocVsCodeMcpProvider (adapter)                   │
├─────────────────────────────────────────────────────────┤
│                   Capability Layer                       │
│  External MCP servers (RenderDoc, custom tools, etc.)  │
└─────────────────────────────────────────────────────────┘
```

### 核心原则

1. **不强依赖任何单一工具** — 所有外部图形工具通过 Provider 抽象接入
2. **Provider 和 Workflow 解耦** — Workflow 层不知道具体 MCP server 名或工具名
3. **Graphics Mode 是正式产品能力** — 独立 Mode，专用 prompt，自动/手动切换
4. **先抽象后实现** — 先定义接口，再接入具体 provider

---

## 文件结构

### 后端 — Provider 层

```
src/services/graphics-provider/
├── GraphicsCaptureProvider.ts          # Provider 接口 + 抽象基类
├── GraphicsProviderTypes.ts            # 所有类型定义
├── GraphicsProviderRegistry.ts         # Provider 注册中心
├── GraphicsProviderError.ts            # 统一错误处理
├── providers/
│   └── renderdoc-vscode-mcp/
│       └── RenderDocVsCodeMcpProvider.ts  # RenderDoc MCP 适配器
└── __tests__/
    └── GraphicsProviderRegistry.spec.ts   # Registry 单元测试
```

### 后端 — Agent 层

```
src/services/graphics-agent/
├── GraphicsIntentRouter.ts             # 意图识别和路由
├── GraphicsWorkflowOrchestrator.ts     # 工作流编排器
├── GraphicsModeManager.ts              # Mode 切换管理
├── GraphicsModeDefinition.ts           # Mode 配置和触发关键词
├── workflows/
│   ├── analyzeCurrentFrame.ts          # 帧分析工作流
│   ├── explainSelectedDraw.ts          # Draw 解释工作流
│   └── findOwnerInProject.ts           # 代码映射工作流
├── playbooks/
│   ├── playbookRunner.ts               # Playbook 运行器
│   ├── blackScreen.ts                  # 黑屏排查
│   ├── gpuSlow.ts                      # GPU 慢排查
│   └── heavyShader.ts                  # Shader 过重排查
└── __tests__/
    ├── GraphicsIntentRouter.spec.ts     # 意图路由测试
    └── GraphicsWorkflowOrchestrator.spec.ts  # 编排器测试
```

### 前端

```
webview-ui/src/components/graphics/
├── GraphicsWorkspace.tsx               # 主工作区组件
├── FrameTriageCard.tsx                 # 帧分析结果卡片
└── SelectedDrawInsightCard.tsx         # Draw 详情卡片
```

### 集成点

```
src/core/webview/
├── graphicsMessageHandler.ts           # Graphics 消息处理器
└── webviewMessageHandler.ts            # (修改) 集成 graphics 消息路由

src/core/prompts/
├── sections/graphics-agent.ts          # Graphics Mode 专用 prompt
└── system.ts                           # (修改) 注入 graphics prompt

packages/types/src/
├── graphics.ts                         # 共享类型定义
├── mode.ts                             # (修改) 注册 Graphics Mode
├── index.ts                            # (修改) 导出 graphics 类型
└── vscode-extension-host.ts            # (修改) 添加消息类型

webview-ui/src/
└── App.tsx                             # (修改) 添加 graphics tab
```

---

## 核心类型

### GraphicsCaptureProvider

Provider 接口定义了外部图形工具必须实现的能力：

```typescript
interface GraphicsCaptureProvider {
  readonly id: string
  readonly displayName: string
  readonly kind: "mcp" | "extension-bridge" | "hybrid"

  isAvailable(): Promise<boolean>
  getStatus(): Promise<GraphicsProviderStatusInfo>
  getCapabilities(): Promise<GraphicsProviderCapabilities>

  openCurrentCapture(): Promise<OpenCaptureResult>
  getFrameSummary(): Promise<FrameSummaryResult>
  getSelectionContext(): Promise<SelectionContextResult>
  getEventDetails(eventId): Promise<EventDetailsResult>
  getPipelineState(eventId): Promise<PipelineStateResult>
  getShaderInfo(input): Promise<ShaderInfoResult>
  findProjectImplementation(input): Promise<ProjectMappingResult>
}
```

### GraphicsProviderCapabilities

声明 Provider 支持的能力子集：

```typescript
interface GraphicsProviderCapabilities {
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

### GraphicsIntent

用户意图分类：

| Intent | 说明 | 触发示例 |
|--------|------|----------|
| `frame_summary` | 帧概览 | "分析当前帧" |
| `frame_performance` | 帧性能 | "为什么这帧慢" |
| `selected_draw_explain` | Draw 解释 | "解释当前 draw" |
| `shader_analysis` | Shader 分析 | "shader 为什么慢" |
| `pipeline_analysis` | Pipeline 分析 | "pipeline state" |
| `resource_trace` | 资源追踪 | "这个纹理从哪来" |
| `project_mapping` | 代码映射 | "对应哪段代码" |
| `regression_compare` | 回归对比 | "对比 capture" |
| `graphics_playbook` | 排障手册 | "黑屏排查" |

### GraphicsWorkflowResult

工作流执行结果：

```typescript
interface GraphicsWorkflowResult {
  summary: string                    // 结论
  evidence: EvidenceItem[]           // 证据
  suspectedIssues: SuspectedIssue[]  // 疑似问题
  suggestions: string[]              // 建议
  projectMapping?: ProjectMappingCandidate[]  // 代码映射
  rawData?: Record<string, unknown>  // 原始数据
  success: boolean
  error?: string
}
```

---

## 工作流程

### 1. 帧分析 (Analyze Current Frame)

```
用户: "分析当前帧"
  │
  ▼
GraphicsIntentRouter.detectGraphicsIntent()
  │ → intent: "frame_summary"
  ▼
GraphicsWorkflowOrchestrator.execute()
  │ → preflightCheck({ frameSummary: true, passGraph: true })
  │ → 获取 Provider
  ▼
AnalyzeCurrentFrameWorkflow.execute()
  │
  ├─ provider.openCurrentCapture()
  ├─ provider.getFrameSummary()
  │   ├─ 分析 pass 结构
  │   ├─ 识别热点事件
  │   └─ 评估帧性能
  ├─ provider.getEventDetails(hotEvent)  // 对热点事件
  │
  ▼
GraphicsWorkflowResult
  ├─ summary: "帧耗时 24.5ms，ShadowMapPass 占 33%"
  ├─ evidence: [帧数据, pass 列表, 热点事件]
  ├─ suspectedIssues: [ShadowMapPass 过热]
  └─ suggestions: ["优化 shadow map 分辨率", ...]
```

### 2. Draw 解释 (Explain Selected Draw)

```
用户: "解释当前 draw"
  │
  ▼
GraphicsIntentRouter → intent: "selected_draw_explain"
  │
  ▼
ExplainSelectedDrawWorkflow.execute()
  │
  ├─ provider.getSelectionContext()     // 获取当前选中
  ├─ provider.getEventDetails(eventId)  // 事件详情
  ├─ provider.getPipelineState(eventId) // 管线状态
  ├─ provider.getShaderInfo(eventId)    // Shader 信息
  │
  ▼
GraphicsWorkflowResult
  ├─ summary: "EID 42: DrawMesh, 5.0ms, 10000 primitives"
  ├─ evidence: [事件详情, 管线状态, shader 信息]
  ├─ suspectedIssues: [高图元数量]
  └─ suggestions: ["考虑使用 LOD", ...]
```

### 3. 代码映射 (Find Owner In Project)

```
用户: "这个 shader 对应哪段代码"
  │
  ▼
GraphicsIntentRouter → intent: "project_mapping"
  │
  ▼
FindOwnerInProjectWorkflow.execute()
  │
  ├─ 解析用户消息 → { kind: "shader", identifier: "..." }
  ├─ provider.getSelectionContext()     // 获取上下文
  ├─ provider.findProjectImplementation()
  │
  ▼
GraphicsWorkflowResult
  ├─ summary: "找到 1 个高置信度匹配"
  ├─ projectMapping: [{ filePath, line, functionName, confidence }]
  └─ suggestions: ["查看 shader 代码", ...]
```

### 4. Playbook 执行

```
用户: "黑屏排查"
  │
  ▼
GraphicsIntentRouter → intent: "graphics_playbook", playbookId: "black_screen"
  │
  ▼
PlaybookRunner.runPlaybook("black_screen")
  │
  ├─ provider.getFrameSummary()
  │   └─ 检查是否有 pass
  ├─ 对前 5 个 draw call:
  │   ├─ provider.getEventDetails()
  │   ├─ provider.getPipelineState()
  │   │   └─ 检查 render target / depth / viewport
  │   └─ provider.getShaderInfo()
  │       └─ 检查 shader 输出
  ├─ 检查 clear 操作
  │
  ▼
GraphicsWorkflowResult
  ├─ summary: "发现 1 个高置信度问题"
  ├─ suspectedIssues: ["EID 42: 没有绑定渲染目标"]
  └─ suggestions: ["检查 EID 42 的渲染目标绑定", ...]
```

---

## Graphics Mode

### Mode 配置

```typescript
{
  slug: "graphics",
  name: "🎮 Graphics",
  roleDefinition: "You are Vertex, a specialized graphics rendering engineer...",
  whenToUse: "Use this mode when analyzing GPU captures...",
  description: "Analyze GPU captures, shaders, and rendering pipelines",
  groups: ["read", "edit", "command", "mcp"],
}
```

### Mode 切换方式

| 方式 | 说明 |
|------|------|
| 手动切换 | 用户在 Mode Selector 中选择 Graphics |
| 自动建议 | 检测到图形意图时提示切换 |
| 临时切换 | 高置信意图下自动临时进入 Graphics 语义 |

### Mode 退出策略

- 用户手动切回其他 Mode
- 会话结束时重置
- 连续非图形问题后建议退出（后续实现）

### 触发关键词

中英文关键词均可触发：

- `renderdoc`, `capture`, `frame`, `draw call`, `shader`, `pipeline`
- `帧`, `绘制`, `着色器`, `管线`, `黑屏`, `阴影`

---

## Provider Registry

### 注册流程

```typescript
const registry = new GraphicsProviderRegistry()

// 注册 RenderDoc MCP provider
const renderDocProvider = new RenderDocVsCodeMcpProvider(mcpHub)
registry.registerProvider(renderDocProvider)

// 未来可以注册更多 provider
// registry.registerProvider(customMcpProvider)
// registry.registerProvider(nvidiaNsightProvider)
```

### Provider 选择策略

1. 优先使用用户显式选中的 provider
2. 未选择时，根据 workflow 所需 capability 自动匹配
3. 能力不足时，降级执行或提示切换 provider

### Preflight Check

每个 workflow 在执行前会进行 capability 检查：

```typescript
// analyzeCurrentFrame.ts
export const requiredCapabilities = {
  frameSummary: true,
  passGraph: true,
}

// Orchestrator 执行时
const provider = await registry.preflightCheck(workflow.requiredCapabilities)
// 如果缺少能力 → 抛出 GraphicsProviderError
```

---

## 消息流

### Webview → Extension

```
WebviewMessage {
  type: "runGraphicsWorkflow" | "runGraphicsPlaybook" |
        "selectGraphicsProvider" | "requestGraphicsProviderStatus"
  graphicsIntent?: string
  graphicsPlaybookId?: string
  graphicsProviderId?: string
  text?: string
}
```

### Extension → Webview

```
ExtensionMessage {
  type: "graphicsResult" | "graphicsWorkflowStarted" |
        "graphicsProviderStatus" | "graphicsProviderSelected"
  values: {
    result: GraphicsWorkflowResult
    providerId: string
    providerName: string
    timestamp: number
  }
}
```

### 消息处理流程

```
Webview (GraphicsWorkspace)
  │ postMessage({ type: "runGraphicsWorkflow", graphicsIntent: "frame_summary" })
  ▼
webviewMessageHandler.ts
  │ 检测 graphics 消息类型
  │ 路由到 handleGraphicsMessage()
  ▼
graphicsMessageHandler.ts
  │ handleRunGraphicsWorkflow()
  │ → getGraphicsOrchestrator()
  │ → orchestrator.execute({ intent, userMessage })
  ▼
GraphicsWorkflowOrchestrator
  │ preflightCheck → Provider
  │ workflow.execute(provider, request)
  ▼
postMessageToWebview({ type: "graphicsResult", values: { result, ... } })
  ▼
Webview (GraphicsWorkspace)
  │ 更新 UI 显示结果
```

---

## 错误处理

### 错误码

| 错误码 | 说明 |
|--------|------|
| `PROVIDER_NOT_FOUND` | Provider ID 不存在 |
| `PROVIDER_UNAVAILABLE` | Provider 不可用 |
| `NO_CAPTURE_OPEN` | 没有打开的 capture |
| `CAPABILITY_MISMATCH` | Provider 缺少所需能力 |
| `NO_SUITABLE_PROVIDER` | 没有合适的 provider |
| `TOOL_CALL_FAILED` | MCP 工具调用失败 |
| `TIMEOUT` | Provider 超时 |

### 降级策略

- Provider 不可用 → 提示用户安装/启动图形工具
- Capture 未打开 → 提示用户先打开 capture
- 能力不足 → 跳过依赖该能力的步骤，或提示切换 provider
- 工具调用失败 → 记录错误，继续执行其他步骤

---

## 测试

### 单元测试

| 测试文件 | 覆盖内容 |
|----------|----------|
| `GraphicsIntentRouter.spec.ts` | 意图识别、关键词检测、Mode 切换建议 |
| `GraphicsWorkflowOrchestrator.spec.ts` | 工作流执行、错误处理、Provider 交互 |
| `GraphicsProviderRegistry.spec.ts` | 注册/注销、选择、能力匹配、preflight |

### 运行测试

```bash
# 运行所有 graphics 相关测试
npx vitest run src/services/graphics-agent/__tests__/
npx vitest run src/services/graphics-provider/__tests__/
```

---

## 后续扩展

### Phase 5: 多 Provider 管理

- Provider 选择 UI
- Provider 能力对比
- 跨 Provider 聚合（A 提供 frame summary，B 提供 shader info）

### Phase 6: 回归分析

- Event / Pipeline / Shader diff
- Capture 对比分析
- 结果历史与复盘

### 更多 Playbook

- 阴影问题排查 (shadow_issue)
- TAA ghosting 排查
- 资源绑定异常排查
- Overdraw 分析

### 更多 Provider

- 独立 RenderDoc MCP
- NVIDIA Nsight Graphics
- AMD GPU PerfStudio
- 团队内部自研工具
