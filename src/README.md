# Vertex Code

> 面向 VS Code 的模式驱动 AI 编程代理：把多模型路由、工具执行、代码理解、可恢复任务和图形调试能力组合到同一个编辑器工作流中。

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

## 目录

- [项目是什么](#项目是什么)
- [功能模块](#功能模块)
- [单模型与多模型切换](#单模型与多模型切换)
- [核心特点](#核心特点)
- [运行架构](#运行架构)
- [代码结构](#代码结构)
- [快速开始](#快速开始)
- [开发命令](#开发命令)
- [扩展配置](#扩展配置)
- [适合的使用场景](#适合的使用场景)
- [技术栈](#技术栈)
- [许可证](#许可证)

## 项目是什么

Vertex Code 是一个运行在 VS Code 中的 AI Agent 扩展。它不是单纯的聊天窗口，而是围绕“任务”组织完整的工程执行闭环：

```text
用户目标
  ↓
模式与配置选择
  ↓
上下文 / Prompt / Skill 组装
  ↓
模型请求与流式响应
  ↓
工具调用：读写文件、搜索、终端、MCP、模式切换……
  ↓
结果回注、检查点、历史记录、下一轮推理
```

项目包含一个 VS Code Extension Host、一个 React Webview 前端，以及多个可复用的 workspace package。扩展入口位于 [`src/extension.ts`](src/extension.ts:111)，任务运行时位于 [`src/core/task/Task.ts`](src/core/task/Task.ts:141)。

## 功能模块

### 1. 模式驱动 Agent

模式（Mode）决定 Agent 的角色、系统指令、可用工具组和执行边界。内置模式包括：

| 模式 | 定位 | 典型用途 |
|---|---|---|
| **Code** | 工程实现代理 | 写代码、改代码、运行命令、修复问题 |
| **Architect** | 架构与方案代理 | 需求分析、技术设计、代码审查、拆解任务 |
| **Ask** | 技术问答代理 | 解释概念、阅读代码、快速咨询 |
| **Debug** | 问题诊断代理 | 分析错误、定位根因、制定修复路径 |
| **Graphics** | 图形工程代理 | Shader、GPU、RenderDoc、渲染管线分析 |
| **Translate** | 翻译与本地化代理 | 翻译文本、维护语言资源 |
| **Issue / PR** | 协作流程代理 | GitHub Issue、PR 分析和修复流程 |
| **Docs Extractor** | 文档分析代理 | 从代码和文档中提取用户文档素材 |

模式定义和查找逻辑集中在 [`src/shared/modes/`](src/shared/modes/index.ts:1)。模式可以通过配置扩展，也可以在任务过程中按需切换。

### 2. 多模型与统一 API 层

项目将模型供应商差异收敛到 Provider 和 Transform 层，上层任务引擎使用统一的消息、工具和流式响应抽象。

已覆盖或适配的模型生态包括：

- Anthropic / Claude
- OpenAI、OpenRouter、Together、DeepSeek
- Google Gemini、Vertex AI
- AWS Bedrock
- Mistral、Minimax、ZAI、R1
- xAI、Moonshot、Fireworks、Baseten、SambaNova、Poe 等
- Ollama、LM Studio 等本地或兼容服务
- VS Code Language Model API
- OpenAI Responses API、Vercel AI Gateway 等路由协议

主要实现位于 [`src/api/providers/`](src/api/providers/anthropic.ts:32) 和 [`src/api/transform/`](src/api/transform/openai-format.ts:1)。支持供应商格式转换、流式响应解析、推理内容保留、Token 统计、成本统计和部分供应商的 Prompt Cache。

### 单模型与多模型切换

Vertex Code 同时支持“单模型工作流”和“多模型协同工作流”，两者可以根据任务复杂度灵活切换。

#### 单模型模式

单模型模式下，整个任务使用一个当前激活的 Provider Profile：

- 适合连续对话、快速编码和简单修复
- 上下文、工具调用和推理过程保持在同一个模型中
- 可以在 UI 中直接切换当前 Provider、模型或 Profile
- 通过 `lockApiConfigAcrossModes` 可让所有 Mode 固定使用同一套模型配置

这种方式链路简单、上下文一致，适合作为默认开发模式。

#### 多模型模式

多模型模式下，可以为不同 Mode 绑定不同的 Provider Profile，由 Mode Routing 在运行时选择：

```text
Architect  → 高能力推理模型：需求拆解、架构设计
Code       → 高性价比编码模型：实现、编辑、终端执行
Debug      → 擅长分析和长上下文的模型：定位根因
Graphics   → 支持图形分析或视觉输入的模型：Shader / Capture / GPU
Ask        → 响应快、成本低的模型：解释和快速问答
```

多模型路由由 [`ModeRoutingResolver`](src/services/mode-routing/ModeRoutingResolver.ts:34) 和 [`ProviderSettingsManager`](src/core/config/ProviderSettingsManager.ts:55) 协同完成，主要特点是：

- 每个 Mode 可以绑定独立的 Provider Profile
- Profile 可以来自不同供应商、不同模型或不同参数组合
- 切换 Mode 时自动解析目标 Profile
- 切换过程中保留任务上下文，并记录模式 / Profile 变化
- 支持显式指定 Profile，显式选择优先于 Mode 默认绑定
- 支持任务级 Profile 和全局 Profile 回退
- 切换模型时可生成结构化 Mode Handoff，向新模型传递目标、已完成事项、待办事项和验收标准
- 当目标 Mode 没有独立配置时，自动回退到当前或全局配置

多模型路由总开关为 `modeLevelLlmRoutingEnabled`。开启后按 Mode 路由；关闭后所有 Mode 使用全局 Profile。旧版配置 `lockApiConfigAcrossModes` 仍然兼容，两者的关系由 [`resolveRoutingEnabled()`](src/services/mode-routing/ModeRoutingResolver.ts:74) 统一解析。

#### 单模型和多模型的选择建议

| 需求 | 推荐方式 | 原因 |
|---|---|---|
| 连续对话、快速修改 | 单模型 | 上下文连续，配置简单 |
| 架构设计后直接进入编码 | 多模型 | 设计和实现可使用各自擅长的模型 |
| 大型项目的 Debug | 多模型 | 分析型模型与编码型模型可以分工 |
| Graphics / RenderDoc 工作流 | 多模型 | Graphics Mode 可绑定专用模型或视觉能力模型 |
| 成本敏感的日常开发 | 多模型 | 简单任务使用轻量模型，复杂任务使用高能力模型 |
| 需要严格固定输出行为 | 单模型 | 避免跨模型切换带来的风格和能力差异 |

切换并不等于丢失上下文。任务会记录当前 Mode、Provider Profile 和请求元数据；跨模型时，运行时会根据需要清洗不兼容的历史字段，并通过 Handoff 传递可执行的任务摘要。

### 3. 工具执行系统

Agent 可以通过结构化工具完成实际工程操作。工具实现集中在 [`src/core/tools/`](src/core/tools/ReadFileTool.ts:71)，常见能力包括：

- 读取文件和目录
- 搜索文件、代码和符号
- 创建、编辑、删除文件
- Search/Replace 和 Patch 风格的精确修改
- 执行终端命令并读取命令输出
- 处理图片、PDF、DOCX、XLSX 等上下文
- 使用 MCP Server 工具和资源
- 安装、调用和管理 Skill
- 创建子任务、切换 Mode、跨 Mode 委派
- 管理 Todo、检查点和任务完成报告

工具执行受到当前模式的工具组、文件限制、`rooignore` 规则和用户审批策略共同约束。

### 4. 文件编辑、差异和检查点

文件修改不是简单覆盖，而是通过差异策略和编辑确认流程完成：

- 支持精确编辑、Search/Replace、Apply Diff、Apply Patch
- 支持模糊匹配和多处替换策略
- 在工作区中展示修改前后差异
- 为任务保存文件状态检查点
- 支持恢复检查点、回滚任务变更和删除任务数据

相关实现位于 [`src/core/diff/`](src/core/diff/strategies/multi-search-replace.ts:75)、[`src/core/checkpoints/`](src/core/checkpoints/index.ts:1) 和 [`src/services/checkpoints/`](src/services/checkpoints/ShadowCheckpointService.ts:1)。

### 5. 任务历史与可恢复执行

每个任务都拥有独立的身份、消息历史、API 会话记录、Todo、模式和 Provider 配置。任务运行时支持：

- 新建、取消、恢复和删除任务
- 任务历史浏览与重新打开
- 父任务 / 子任务关系
- 子任务完成后的结果回传
- 任务取消时的资源释放和状态持久化
- 流式失败重试和上下文超限恢复
- 上下文压缩与对话摘要

任务生命周期的主要协调者是 [`src/core/webview/ClineProvider.ts`](src/core/webview/ClineProvider.ts:136) 和 [`src/core/task/Task.ts`](src/core/task/Task.ts:141)。

### 6. 上下文工程与代码理解

项目提供多层上下文处理能力：

- 工作区环境信息和当前文件上下文
- 文件 Mention、图片 Mention 和路径 Mention
- 语义代码索引与向量搜索
- Tree-sitter 代码解析和代码块抽取
- 上下文窗口监控、压缩和摘要
- 文件变更追踪，避免使用过期上下文
- `rooignore` 和受保护文件规则

代码索引服务位于 [`src/services/code-index/`](src/services/code-index/manager.ts:19)，上下文压缩位于 [`src/core/condense/`](src/core/condense/index.ts:1)。向量存储和 Embedding Provider 可以按配置使用 Qdrant、OpenAI 兼容服务、Gemini、Mistral、Bedrock、Ollama 等实现。

### 7. Skill 系统与 Marketplace

Skill 是可安装、可发现、按模式生效的专业工作流。Skill 通常由 `SKILL.md` 描述，包含名称、说明、适用模式和执行指令。

Skill 生命周期包括：

1. 从项目目录或全局目录发现 Skill
2. 校验名称、描述和 Front Matter
3. 根据当前 Mode 过滤可用 Skill
4. 按项目优先于全局、模式专用优先于通用的规则解析覆盖关系
5. 需要时加载 Skill 内容并执行
6. 监听目录变化，自动刷新 Skill 列表

Skill 引擎位于 [`src/services/skills/SkillsManager.ts`](src/services/skills/SkillsManager.ts:21)，Marketplace 安装逻辑位于 [`src/services/marketplace/SkillInstaller.ts`](src/services/marketplace/SkillInstaller.ts:33)。除 Skill 外，Marketplace 还支持知识条目等可安装内容。

### 8. MCP 集成

Vertex Code 支持 Model Context Protocol，用于连接外部工具、资源和数据源。MCP 模块包含：

- MCP Server 配置和生命周期管理
- Tool / Resource 发现
- OAuth 登录和 Token 保存
- 回调服务器
- MCP 工具调用和结果回传
- 与当前任务、Mode 和审批策略集成

核心实现位于 [`src/services/mcp/McpHub.ts`](src/services/mcp/McpHub.ts:155) 和 [`src/services/mcp/McpServerManager.ts`](src/services/mcp/McpServerManager.ts:10)。

### 9. Graphics Mode 与 RenderDoc

Graphics Mode 是项目的专用图形分析工作流，包含意图识别、Provider 抽象、工作流编排、知识库和调试 Playbook。

支持的分析方向包括：

- 当前帧概览和帧性能
- Draw Call 与选中事件解释
- Pipeline State 分析
- Shader 信息和源码分析
- 纹理、Buffer、Mesh 等资源追踪
- Capture 与项目源码映射
- 两次 Capture 的回归对比

Graphics Agent 的关键模块：

| 模块 | 作用 |
|---|---|
| [`GraphicsIntentRouter`](src/services/graphics-agent/GraphicsIntentRouter.ts:174) | 从用户请求识别图形意图 |
| [`GraphicsModeManager`](src/services/graphics-agent/GraphicsModeManager.ts:49) | 根据置信度决定是否建议或自动切换模式 |
| [`GraphicsWorkflowOrchestrator`](src/services/graphics-agent/GraphicsWorkflowOrchestrator.ts:54) | 将意图路由到具体工作流 |
| [`GraphicsProviderRegistry`](src/services/graphics-provider/GraphicsProviderRegistry.ts:117) | 注册 Provider 并匹配能力 |
| [`RenderDocVsCodeMcpProvider`](src/services/graphics-provider/providers/renderdoc-vscode-mcp/RenderDocVsCodeMcpProvider.ts:78) | 连接 RenderDoc for VS Code MCP |
| [`playbookRunner`](src/services/graphics-agent/playbooks/playbookRunner.ts:117) | 运行结构化图形问题排查流程 |

内置 Playbook 包括 `black_screen`、`gpu_slow`、`heavy_shader` 和 `shadow_issue`。标准结果格式为：

```text
结论 → 证据 → 疑似问题 → 下一步
```

### 10. Webview 用户界面

前端位于 [`webview-ui/`](webview-ui/package.json:1)，通过 VS Code Webview 消息协议与 Extension Host 通信，提供：

- 对话和任务流界面
- Markdown、代码高亮、数学公式和 Mermaid 渲染
- 文件修改和差异展示
- 设置、Provider、模型和配置档案管理
- 任务历史和任务操作
- Skill / Marketplace 界面
- MCP 管理界面
- Worktree 管理
- Token、成本和上下文窗口展示
- 主题、国际化、音效和无障碍交互基础能力

前端采用 React 18、Vite、Radix UI、Tailwind CSS 和 Vitest。

### 11. VS Code 集成与工程辅助

扩展还提供多种原生编辑器集成：

- Activity Bar Sidebar 和 Editor Tab
- Editor Context Menu
- Code Actions：解释、修复、改进、加入上下文
- Terminal Context Menu
- URI Handler 和外部链接处理
- Diff View 和编辑器装饰
- Terminal 进程管理、Shell Profile 和输出拦截
- Worktree 创建、切换和自动打开
- 自定义存储路径和配置导入
- 国际化资源，覆盖多种语言

## 核心特点

### 模式约束，而不是无边界聊天

每个模式都可以定义角色、工具组、文件限制和专用指令。Agent 的行为边界由配置显式表达，更适合工程场景中的可控自动化。

### Provider 与协议解耦

模型调用、消息格式转换、流式解析和缓存策略分层设计。新增供应商主要集中在 Provider 和 Transform 层，不需要改动整个任务引擎。

### 工具结果驱动的闭环执行

模型不是只输出建议，而是通过工具读取真实工程状态、执行命令、修改文件，再根据工具结果继续推理。

### 可恢复、可审计的任务状态

任务历史、检查点、差异、审批和工具调用都围绕任务保存，便于取消、恢复、回滚和复盘。

### 专业能力可插拔

Skill、MCP Provider、Graphics Provider、Embedding Provider 和自定义 Mode 都可以独立扩展，形成组合式能力体系。

### Graphics 工作流强调事实和证据

图形分析通过能力检查、Provider 抽象和结构化 Playbook 工作，结果区分结论、证据、疑似问题和下一步，减少无依据推断。

### Monorepo 与共享包

类型、核心逻辑、IPC、构建工具、VS Code Shim 和配置通过 workspace package 复用；根目录使用 Turborepo 统一编排构建、检查和测试。

## 运行架构

```text
┌────────────────────────────────────────────────────────┐
│ VS Code Extension Host                                 │
│ src/extension.ts                                       │
│  ├─ ClineProvider / Webview 生命周期                   │
│  ├─ Task / Agent Runtime                                │
│  ├─ API Providers + Format Transforms                  │
│  ├─ Tools / MCP / Skills / Checkpoints                  │
│  ├─ Code Index / Context Management                     │
│  └─ Graphics Agent / Capture Providers                  │
└───────────────────────┬────────────────────────────────┘
                        │ Webview Message Protocol
                        ▼
┌────────────────────────────────────────────────────────┐
│ React Webview                                          │
│ webview-ui/                                            │
│  ├─ Chat and task UI                                   │
│  ├─ Settings and provider UI                           │
│  ├─ History / checkpoint / diff UI                     │
│  ├─ Marketplace / Skills / MCP UI                      │
│  └─ Graphics result UI                                 │
└────────────────────────────────────────────────────────┘

External integrations:
  Model Providers · MCP Servers · RenderDoc · Qdrant · VS Code API
```

一次任务的关键链路是：[`activate()`](src/extension.ts:111) → [`ClineProvider.createTask()`](src/core/webview/ClineProvider.ts:2962) → [`Task`](src/core/task/Task.ts:141) → Provider / Transform → Tool Runtime → 持久化与 Webview 更新。

## 代码结构

```text
vertex-code/
├── src/                         # VS Code 扩展工作区
│   ├── extension.ts             # 扩展入口
│   ├── activate/                # 命令、URI、Code Action、Terminal Action
│   ├── api/                    # Provider、格式转换、流式处理、缓存
│   ├── core/                   # Task、Tools、Prompt、Diff、Context、Webview
│   ├── services/               # MCP、Skills、Marketplace、Code Index、Graphics
│   ├── integrations/           # Editor、Terminal、Workspace 等 VS Code 集成
│   ├── shared/                 # 模式、工具、配置和共享数据结构
│   └── i18n/                   # 扩展内部国际化资源
├── webview-ui/                 # React + Vite 前端
├── packages/
│   ├── core/                   # 可复用核心能力
│   ├── types/                  # @roo-code/types 共享类型
│   ├── ipc/                    # 进程间通信
│   ├── build/                  # 构建工具
│   ├── vscode-shim/            # VS Code API 测试替身
│   └── config-*                # 共享 ESLint / TypeScript 配置
├── schemas/                    # 配置和协议 Schema
├── scripts/                    # Bootstrap、构建和发布脚本
├── docs/                       # 项目文档
└── plans/                      # 工程规划和进度记录
```

## 快速开始

### 环境要求

- Node.js `20.20.2`
- pnpm `10.8.1`
- VS Code `^1.84.0`

### 安装和运行

```bash
git clone https://github.com/Kirkice/Vertex-Code.git
cd Vertex-Code
pnpm install
pnpm build
```

然后在 VS Code 中打开项目并按 `F5`，启动 Extension Development Host。

### 配置模型

启动扩展后，在 Vertex 设置界面中选择模型 Provider 并填写对应凭据。具体凭据字段由 Provider 决定；不要把 API Key 提交到仓库，建议使用 VS Code Secret Storage、环境变量或本地设置。

### 本地调试

```bash
pnpm install
pnpm check-types
pnpm build
```

开发时可以使用 VS Code 的调试配置启动扩展，修改 `src/` 或 `webview-ui/` 后根据对应构建任务重新加载。

## 开发命令

| 命令 | 作用 |
|---|---|
| `pnpm install` | 安装所有 workspace 依赖 |
| `pnpm build` | 构建全部工作区 |
| `pnpm bundle` | 生成扩展生产 bundle |
| `pnpm check-types` | 执行所有工作区 TypeScript 类型检查 |
| `pnpm lint` | 执行 ESLint 检查 |
| `pnpm test` | 执行所有工作区 Vitest 测试 |
| `pnpm test:coverage` | 执行测试并生成覆盖率 |
| `pnpm format` | 使用 Prettier 格式化代码 |
| `pnpm vsix` | 打包 VS Code `.vsix` 安装包 |
| `pnpm install:vsix` | 安装、清理、构建并安装 VSIX |
| `pnpm clean` | 清理构建产物和缓存 |

根目录脚本通过 [`package.json`](package.json:10) 和 [`turbo.json`](turbo.json:1) 编排，具体工作区脚本分别位于 [`src/package.json`](src/package.json:421) 和 [`webview-ui/package.json`](webview-ui/package.json:6)。

## 扩展配置

扩展配置定义在 [`src/package.json`](src/package.json:53) 的 `contributes.configuration` 中，主要配置方向包括：

- Provider、模型和配置档案
- 自动审批与允许执行的命令
- 自定义 Mode
- Skill 和 MCP 相关选项
- Code Index、Embedding 和最大索引文件数
- API 请求超时
- 调试代理和 TLS 选项
- 自定义存储路径、语言和导入设置

自定义 Mode 示例：

```json
{
  "vertex.customModes": [
    {
      "slug": "reviewer",
      "name": "Code Reviewer",
      "roleDefinition": "You are a senior code reviewer.",
      "customInstructions": "Focus on correctness, security, and maintainability.",
      "toolGroups": ["read", "search"]
    }
  ]
}
```

Skill 可以放在项目级或全局 Roo 配置目录中，并通过 `SKILL.md` 描述元数据和指令。具体覆盖规则以 [`SkillsManager`](src/services/skills/SkillsManager.ts:184) 为准。

## 适合的使用场景

- 在真实代码库中实现跨文件功能
- 分析 Bug、错误日志和测试失败
- 进行代码重构、依赖升级和 API 迁移
- 阅读陌生仓库并生成架构理解
- 通过终端运行测试、构建、Lint 和诊断命令
- 使用 MCP 连接数据库、文档、浏览器或内部工具
- 创建团队级自定义 Mode 和 Skill
- 分析 RenderDoc Capture、Draw Call、Shader 和 GPU 性能
- 比较任务前后的文件差异并在需要时恢复检查点

## 技术栈

| 层 | 技术 |
|---|---|
| 语言 | TypeScript 5.8 |
| 宿主 | VS Code Extension API |
| 运行时 | Node.js 20 |
| 包管理 | pnpm 10 |
| Monorepo | Turborepo |
| 扩展构建 | esbuild |
| 前端 | React 18、Vite、Tailwind CSS、Radix UI |
| 测试 | Vitest、Testing Library |
| 模型协议 | OpenAI、Anthropic、Gemini、Bedrock、MCP 等 |
| 代码理解 | Tree-sitter、Embedding、Qdrant |
| 图形调试 | RenderDoc for VS Code MCP |
| 质量工具 | TypeScript、ESLint、Prettier、Husky |

## 项目状态

这是一个持续演进中的大型 VS Code AI Agent 工程。由于支持的模型、MCP Server、图形 Provider 和本地环境差异较大，运行完整测试或构建时请优先使用项目声明的 Node.js 版本 `20.20.2`。

## 许可证

本项目使用 [Apache License 2.0](LICENSE) 授权。
