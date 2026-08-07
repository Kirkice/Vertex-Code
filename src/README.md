# Vertex Code

> 面向工程研发与图形开发的可扩展 VS Code Agent 平台。
>
> Vertex Code 不只是一个聊天式 Agent：它将 Agent、模型路由、工具执行、知识与 Skill、MCP、图形调试工具链以及可复用能力市场组合成一套完整的能力建设体系。

<p align="center">
  <img alt="Vertex Code" src="https://raw.githubusercontent.com/Kirkice/Vertex-Code/main/src/assets/icons/panel_logo.png" width="128">
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=VertexOrganization.vertex">VS Code Marketplace</a>
  ·
  <a href="https://github.com/Kirkice/Vertex-Code">GitHub</a>
  ·
  <a href="LICENSE">Apache-2.0</a>
</p>

## 我们在构建什么

Vertex Code 的目标不是简单地“让模型写代码”，而是在 VS Code 内建立一套可持续演进的 Agent 工程基础设施：

- **Agent 层**：通过不同模式承载编码、架构设计、调试、图形分析、文档、Issue 和 PR 等专业角色。
- **能力层**：通过 Tools、MCP、Skills、知识库、项目索引和工作流，把模型连接到真实工程环境。
- **平台层**：通过 Extension Host、Webview、消息协议、Provider 抽象、状态持久化和可恢复任务，提供稳定的执行基础。
- **生态层**：通过独立的图形工具和 Agent 市场，把能力从单一插件扩展为可组合的开发工具链。

因此，Vertex Code 既是一个可直接使用的 VS Code Agent，也是一个用于建设专业 Agent 能力的开放平台。

## 能力生态与工具链

Vertex Code 与以下项目共同组成完整的工程与图形开发链路：

| 项目 | 定位 | 能力 |
|---|---|---|
| [Vertex Code](https://github.com/Kirkice/Vertex-Code) | Agent 平台 | 模型路由、模式系统、工具调用、MCP、Skills、任务恢复、代码理解和图形工作流 |
| [RenderDoc for VS Code](https://github.com/Kirkice/renderdoc-for-vscode) | 图形调试工具 | 将 RenderDoc 的捕获、帧分析和图形调试能力带入 VS Code 工作流 |
| [Desmos for VS Code](https://github.com/Kirkice/desmos-for-vscode) | 数学与函数可视化工具 | 在 VS Code 中创建、编辑和可视化函数图像，辅助 Shader、算法和图形数学分析 |
| [vertex-code-market](https://github.com/Kirkice/vertex-code-market) | Agent 能力市场 | 分发和组织可复用的 Agent、Skill、Knowledge、MCP 与图形开发能力 |

典型协作方式：

```text
Vertex Code
  ├─ 负责理解需求、规划任务、调用工具和组织执行
  ├─ 通过 Skills / Knowledge / MCP 获得专业能力
  ├─ 通过 RenderDoc for VS Code 获取真实图形调试上下文
  ├─ 通过 Desmos for VS Code 分析和可视化数学关系
  └─ 通过 vertex-code-market 持续安装和扩展 Agent 能力
```

## 核心能力

### 1. 模式驱动的专业 Agent

模式定义了 Agent 的角色、指令、工具边界和执行策略。内置模式包括：

- **Code**：实现功能、重构代码、修复问题和编写测试。
- **Architect**：分析需求、拆解系统并设计实施方案。
- **Ask**：解释代码、API、架构和技术概念。
- **Debug**：定位错误、分析日志、构建最小复现并验证修复。
- **Graphics**：分析 Shader、RenderDoc Capture、Pipeline、Resource 和 GPU 工作负载。
- **Translate**：维护本地化资源。
- **Issue Investigator / Issue Fixer**：调查和实现 GitHub Issue。
- **PR Fixer**：分析 Pull Request 反馈、测试失败和合并冲突。
- **Docs Extractor**：从代码库提取面向用户的文档素材。

模式可以通过项目级或用户级配置扩展。相关实现位于 [`src/shared/modes/index.ts`](src/shared/modes/index.ts:1) 和 [`src/services/mode-routing/ModeRoutingResolver.ts`](src/services/mode-routing/ModeRoutingResolver.ts:34)。

### 2. 模型与 Provider 路由

Provider 层统一处理模型调用、流式响应、格式转换、推理内容、Token 用量和成本信息。可以根据任务类型为不同模式配置不同模型：

- Architect 使用推理能力更强的模型进行方案设计。
- Code 使用面向代码生成和重构的模型。
- Debug 使用擅长故障分析和日志推理的模型。
- Graphics 使用适合 Shader、Capture 和渲染管线分析的模型。

支持的 Provider 类型包括 OpenAI-compatible 服务、Anthropic、Gemini、Vertex AI、Bedrock、Mistral、DeepSeek、xAI、Ollama、LM Studio 以及 VS Code Language Model API 等，具体可用项取决于当前版本和配置。

### 3. 工具、MCP、Skills 与 Knowledge

Agent 可以在真实项目环境中执行结构化操作，而不是只输出建议：

- 读取、搜索、创建、编辑和删除文件。
- 通过精确 Diff 修改代码并检查变更。
- 在审批、超时和安全边界下执行终端命令。
- 调用 MCP Server 提供的 Tools 和 Resources。
- 安装并运行可复用的 Skills。
- 使用项目索引和上下文管理能力理解大型代码库。
- 创建子任务、切换模式、维护 TODO 和任务执行状态。
- 保存检查点，在中断后恢复任务。

MCP 集成的核心实现位于 [`src/services/mcp/McpHub.ts`](src/services/mcp/McpHub.ts:155)。

### 4. 可恢复的工程任务

Vertex Code 将一次复杂请求视为可追踪的工程任务，而不是一次性问答：

1. 理解需求并选择合适模式。
2. 读取项目结构和相关上下文。
3. 生成计划并拆分可执行步骤。
4. 调用工具完成代码、配置或文档变更。
5. 运行检查、测试和构建。
6. 保存执行状态、检查点和结果。
7. 在失败或中断后继续恢复，而不是从头开始。

## Graphics Agent：图形能力建设示例

Graphics Mode 是 Vertex Code 能力建设体系的一个重点方向。它不是孤立的“图形聊天页面”，而是将图形知识、图形工具、Capture Provider、Shader 分析和工程执行连接起来的工作流入口。

### 图形分析能力

- Frame Overview 与帧结构分析。
- Draw Event、Selected Event 和 Pipeline State 检查。
- Shader 信息、Shader Source 和项目代码映射。
- Resource History、Resource Trace 和资源生命周期分析。
- 图形架构盘点、Render Pass 和渲染管线分析。
- 性能瓶颈、带宽、Overdraw、Shader 复杂度和 GPU 工作负载分析。
- 基于证据的诊断结果、风险区域和下一步建议。

### 图形 Feature 开发能力

- 将自然语言需求整理为 Graphics Feature Brief。
- 生成技术方案、任务拆解、资产契约和验收条件。
- 结合项目画像和架构索引进行方案推荐。
- 管理 Feature Plan、任务负责人和执行状态。
- 进行性能预算、平台兼容性和实现约束分析。
- 支持 Asset / Build 校验和图形资源能力接入。

### Runtime Capture 能力

Runtime Capture 通过 Provider 抽象接入外部图形工具，当前重点对接 [RenderDoc for VS Code](https://github.com/Kirkice/renderdoc-for-vscode) 及其 MCP 能力：

- Launch Profile 管理。
- Launch and Capture 工作流。
- Capture 状态与进度反馈。
- 取消、超时、错误恢复和缓存失效。
- Re-Capture Validation。
- Baseline / Candidate Capture 证据比较。
- Frame、Event、Pipeline、Shader 和 Resource 结果回传。
- Investigation Session 持久化和可重复性元数据。

Graphics Agent 的主要扩展点包括 [`src/services/graphics-agent/GraphicsWorkflowOrchestrator.ts`](src/services/graphics-agent/GraphicsWorkflowOrchestrator.ts:54)、[`src/services/graphics-provider/GraphicsCaptureProvider.ts`](src/services/graphics-provider/GraphicsCaptureProvider.ts:51) 和 [`src/services/graphics-provider/providers/renderdoc-vscode-mcp/RenderDocVsCodeMcpProvider.ts`](src/services/graphics-provider/providers/renderdoc-vscode-mcp/RenderDocVsCodeMcpProvider.ts:95)。

### 图形数学与 Shader 可视化

[Desmos for VS Code](https://github.com/Kirkice/desmos-for-vscode) 用于补充图形开发中的数学分析环节，例如：

- 可视化衰减曲线、插值曲线和响应曲线。
- 对比 BRDF、滤波、噪声和波形函数。
- 分析 Shader 中的标量关系和二维数学模型。
- 将算法参数变化直观呈现给开发者。

这使得图形 Agent 不仅能解释 Shader 代码，还能将关键数学关系转化为可观察、可验证的图形。

## 能力市场：从单个 Agent 到可组合生态

[vertex-code-market](https://github.com/Kirkice/vertex-code-market) 是 Vertex 生态中的能力分发中心，用于组织和复用专业能力：

- **Agent**：面向特定领域或任务的角色化 Agent。
- **Skill**：可安装、可组合的操作流程和专业方法。
- **Knowledge**：领域知识、规范、排查手册和最佳实践。
- **MCP**：连接外部工具、服务和数据源的协议能力。
- **Graphics 能力**：Shader、RenderDoc、Render Pipeline、Unity、性能分析等专业工作流。
- **项目模板**：帮助团队快速建立统一的 Agent 工作方式。

通过市场，能力建设可以从“修改一次代码”升级为“沉淀一个可复用的工程能力”：开发者可以安装能力、组合能力、在真实项目中验证能力，再将成熟能力分享给团队或生态。

## 系统架构

```text
┌──────────────────────────────────────────────────────────────┐
│ VS Code Extension Host                                       │
│ [`src/`](src/extension.ts:111)                               │
│  ├─ Agent Runtime / Task Execution                           │
│  ├─ Model Providers / Routing                                │
│  ├─ Tools / MCP / Skills / Knowledge                         │
│  ├─ Workspace Index / Context Management                      │
│  ├─ Checkpoints / Persistence / Recovery                     │
│  └─ Graphics Workflows / Capture Providers                   │
└──────────────────────────────┬───────────────────────────────┘
                               │ Webview Message Protocol
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ React Webview                                                │
│ [`webview-ui/`](webview-ui/package.json:1)                   │
│  ├─ Chat / Task / Settings / History                         │
│  ├─ Provider / MCP / Skill Management                         │
│  ├─ Graphics HUD / Feature Planning                          │
│  └─ Runtime Investigation / Evidence Views                   │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ External Capability Ecosystem                                │
│ Model APIs · MCP Servers · RenderDoc · Desmos · Agent Market │
└──────────────────────────────────────────────────────────────┘
```

## 仓库结构

```text
vertex-code/
├── src/          # VS Code Extension Host、Agent Runtime、Provider 与服务
├── webview-ui/   # React Webview、Chat、HUD 和管理界面
├── packages/     # 共享类型、核心包、构建和测试包
├── schemas/      # 配置与协议 Schema
├── scripts/      # Bootstrap、构建、测试和发布脚本
├── docs/         # 产品、技术和图形开发文档
└── plans/        # 路线图、实施计划和阶段性设计
```

## 快速开始

### 环境要求

- Node.js `20.20.2`。
- pnpm `10.8.1`。
- VS Code `^1.84.0`。
- 你计划使用的模型 Provider 凭据。
- 只有在进行真实 Graphics Capture 验证时，才需要安装 [RenderDoc for VS Code](https://github.com/Kirkice/renderdoc-for-vscode) 和兼容的目标程序。

### 安装与运行

```bash
git clone https://github.com/Kirkice/Vertex-Code.git
cd Vertex-Code
pnpm install
pnpm build
```

在 VS Code 中打开仓库并按 `F5` 启动 Extension Development Host，然后在 Vertex 设置中配置模型 Provider。API Key、Token 等敏感信息应保存到 VS Code Secret Storage、环境变量或本地配置中，不要提交到 Git。

## 开发命令

| 命令 | 说明 |
|---|---|
| `pnpm install` | 安装整个 workspace 的依赖。 |
| `pnpm check-types` | 执行 workspace TypeScript 类型检查。 |
| `pnpm test` | 执行测试套件。 |
| `pnpm lint` | 执行 ESLint。 |
| `pnpm format` | 使用 Prettier 格式化支持的源文件。 |
| `pnpm build` | 构建 workspace。 |
| `pnpm bundle` | 构建 Extension Host bundle。 |
| `pnpm vsix` | 打包 VS Code `.vsix`。 |
| `pnpm clean` | 清理构建产物和本地缓存。 |

Workspace 级脚本见 [`src/package.json`](src/package.json:462) 和 [`webview-ui/package.json`](webview-ui/package.json:6)。图形相关测试可以在对应目录使用 Vitest 执行。

## 配置与安全

扩展配置定义在 [`src/package.json`](src/package.json:307)，覆盖 Provider、模型路由、审批、Modes、Skills、MCP、代码索引、超时、调试代理和存储路径等能力。

提交代码前请检查：

- 不提交 `.env`、API Key、Token 和本地凭据。
- 不提交 `node_modules`、构建输出、Coverage、日志、Turbo Cache 或 TypeScript 临时元数据。
- 使用 `git diff --check` 检查空白和格式问题。
- 对外部 Provider、RenderDoc、目标进程和 MCP 工具使用最小权限原则。

## 项目状态与验证边界

Vertex Code 正在持续建设中。Agent 模式、模型 Provider、Tools、MCP、Skills、任务状态、图形工作流、Graphics HUD、Provider 抽象、缓存、取消、超时和本地测试基础设施已经形成完整实现框架。

真实 RenderDoc MCP 工具名和响应协议、目标程序启动、Live Target 发现、Capture 完成以及目标进程清理，仍需要在用户实际的 Windows、Android、RenderDoc 和目标应用环境中进行端到端验证。README 不将环境相关行为描述为已经在所有平台完成验证。

## 参与贡献

欢迎围绕以下方向贡献能力：

- 新的 Agent Mode、Skill 和 Knowledge。
- 新的 MCP Server 与外部工具适配器。
- 新的模型 Provider 和路由策略。
- Graphics、Shader、Render Pipeline 和性能分析工作流。
- RenderDoc、Desmos 及其他开发工具链集成。
- 测试、文档、示例和团队能力模板。

## License

本项目采用 [Apache License 2.0](LICENSE)。
