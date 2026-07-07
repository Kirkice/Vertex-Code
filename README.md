<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Kirkice/Vertex-Code/main/src/assets/icons/panel_logo.png">
    <img alt="Vertex Code" src="https://raw.githubusercontent.com/Kirkice/Vertex-Code/main/src/assets/icons/panel_light_logo.png" width="128">
  </picture>
</p>

<h1 align="center">Vertex Code</h1>

<p align="center">
  <em>A mode-driven AI coding agent with multi-model orchestration, graphics debugging, and skill-based workflows — running inside your editor.</em>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=VertexOrganization.vertex" target="_blank">
    <img alt="Visual Studio Marketplace Version" src="https://img.shields.io/visual-studio-marketplace/v/VertexOrganization.vertex?color=617A91&label=VS%20Code&logo=visualstudiocode&logoColor=white">
  </a>
  <a href="https://github.com/Kirkice/Vertex-Code/blob/main/LICENSE" target="_blank">
    <img alt="License" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg">
  </a>
  <a href="https://nodejs.org/en/about/releases/" target="_blank">
    <img alt="Node" src="https://img.shields.io/badge/node-20.20.2-339933?logo=node.js&logoColor=white">
  </a>
  <a href="https://code.visualstudio.com/updates/v1_84" target="_blank">
    <img alt="VS Code" src="https://img.shields.io/badge/vscode-%5E1.84.0-007ACC?logo=visualstudiocode&logoColor=white">
  </a>
  <img alt="Monorepo" src="https://img.shields.io/badge/monorepo-turborepo-EF4444?logo=turborepo">
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-5.8-3178C6?logo=typescript&logoColor=white">
</p>

---

## Overview

**Vertex Code** is a full-featured VS Code extension that embeds a **mode-driven AI agent** directly into your editor. Unlike a simple chat panel, Vertex orchestrates autonomous coding tasks through a layered runtime — from **model-agnostic API routing** and **structured tool execution** to **specialized mode workflows** for graphics debugging.

At its core, Vertex treats every task as a **mode-constrained execution**: the active mode defines the agent's role, tool permissions, system instructions, and available skills. This design enables precise control over agent behavior — from free-form code generation to structured graphics capture analysis.

### Key Capabilities

| Area | What It Does |
|------|-------------|
| **Multi-Model Pipeline** | Route requests through 10+ model providers with provider-agnostic format translation |
| **Graphics Mode** | Specialized mode for GPU debugging, frame analysis, shader inspection, and capture-to-code mapping |
| **Skill Market** | Installable, mode-aware skill packages that extend agent capabilities |
| **RenderDoc Integration** | Connect RenderDoc capture data directly into AI reasoning via MCP |
| **MCP Support** | Full Model Context Protocol — connect external tools and data sources |
| **File Editing** | Diff-based edits with multi-search-replace, checkpoint/restore |
| **Terminal Integration** | Execute shell commands, capture output, auto-approve |
| **Code Indexing** | Semantic search across workspace |
| **Custom Modes** | Define your own agent persona with tailored tool permissions |
| **Mode Handoff** | Delegate subtasks between specialised modes |
| **Internationalization** | 20+ locale translations |

---

## Multi-Model Pipeline

Vertex abstracts model providers behind a **unified API layer**, allowing the task engine to remain provider-agnostic while supporting diverse model capabilities.

```
User Prompt
     │
     ▼
┌─────────────────────┐
│   Task Engine        │  Core loop: prompt → tool call → result → prompt
│   src/core/task/     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Prompt Assembly    │  Role definition + custom instructions
│   src/core/prompts/  │  + tool descriptions + skill sections
└─────────┬───────────┘  + conversation history + context
          │
          ▼
┌─────────────────────┐
│   Format Adapter     │  Provider-agnostic message conversion
│   src/api/transform/ │
│                      │
│  ┌────────────────┐  │
│  │ OpenAI Format  │  │  OpenAI / OpenRouter / Together / DeepSeek
│  ├────────────────┤  │
│  │ Anthropic      │  │  Anthropic native format
│  ├────────────────┤  │
│  │ Gemini Format  │  │  Google Gemini
│  ├────────────────┤  │
│  │ Bedrock Format │  │  AWS Bedrock Converse
│  ├────────────────┤  │
│  │ Mistral Format │  │  Mistral AI
│  ├────────────────┤  │
│  │ VSCode LM      │  │  VS Code Language Model API
│  ├────────────────┤  │
│  │ …              │  │  Vertex, minimax, R1, ZAI, Responses API
│  └────────────────┘  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Cache Strategy     │  Multi-point caching per provider
│   src/api/transform/ │  (Anthropic, Gemini, Vertex, Vercel AI)
│   caching/           │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Stream Processing  │  Streaming response → tool calls → execution
│   src/api/transform/ │
│   stream.ts          │
└─────────┬───────────┘
          │
          ▼
     Tool Result → back to Task Engine
```

### How It Works

1. **Prompt Assembly** — The task engine assembles a system prompt from the active mode's role definition, custom instructions, tool group descriptions, and skill sections (see [Skills](#skills--skill-market)).

2. **Format Translation** — The assembled conversation is passed to a provider-agnostic adapter ([`src/api/transform/`](src/api/transform/)). Each provider has its own format module that translates the canonical message structure into the provider-specific wire format.

3. **Caching** — Provider-specific cache strategies ([`src/api/transform/caching/`](src/api/transform/caching/)) manage prompt caching for Anthropic, Gemini, Vertex, and Vercel AI Gateway to reduce costs and latency on repeated prefixes.

4. **Streaming & Tool Execution** — The streaming response ([`src/api/transform/stream.ts`](src/api/transform/stream.ts)) is parsed incrementally. When tool calls are detected, they are routed to the appropriate executor — file edit, terminal command, MCP tool, skill invocation, etc. — and the results feed back into the conversation loop.

### Supported Providers

| Provider | Format | Cache Support |
|----------|--------|---------------|
| Anthropic | Anthropic native | ✅ |
| OpenAI / OpenRouter | OpenAI format | — |
| Google Gemini | Gemini format | ✅ |
| AWS Bedrock | Bedrock Converse | — |
| Mistral AI | Mistral format | — |
| Vertex AI | Vertex format | ✅ |
| VSCode LM | VSCode LM API | — |
| DeepSeek / Together | OpenAI-compatible | — |
| minimax, ZAI, R1 | Custom format | — |
| Responses API | OpenAI Responses | — |

---

## Graphics Mode

**Graphics Mode** is Vertex's specialized execution path for GPU debugging, rendering analysis, and shader development. It transforms the editor into a graphics-aware engineering environment.

```
User: "分析当前帧为什么这么慢"  "解释这个draw call"  "帮我写一个PBR shader"
     │
     ▼
┌─────────────────────────────┐
│  GraphicsIntentRouter        │  Intent classification
│  src/services/graphics-agent/│  (frame_summary, shader_analysis,
│  GraphicsIntentRouter.ts     │   selected_draw_explain, playbook, …)
└──────────┬──────────────────┘
           │ confidence ≥ 0.8 → auto-switch to Graphics Mode
           │ confidence ≥ 0.5 → suggest mode switch
           ▼
┌─────────────────────────────┐
│  Graphics Mode               │  ModeConfig with:
│  GraphicsModeDefinition.ts   │  • Role: Senior graphics engineer
│                              │  • Tool groups: read, edit, command, mcp
│                              │  • Custom instructions: facts-before-inferences,
│                              │    structured output, playbook-first, no fabrication
└──────────┬──────────────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌──────────┐ ┌──────────────┐
│ Provider  │ │   Skills     │
│ Registry  │ │   Engine     │
└─────┬────┘ └──────┬───────┘
      │             │
      ▼             ▼
┌─────────────────────────────────┐
│  Graphics Workflow Orchestrator │  Matches intent → workflow → provider
│  GraphicsWorkflowOrchestrator.ts│
└──────────┬──────────────────────┘
           │
           ▼
   Structured Result (conclusion + evidence + issues + next steps)
```

### Intent Detection

The [`GraphicsIntentRouter`](src/services/graphics-agent/GraphicsIntentRouter.ts) classifies user messages into **9 graphics intent categories** using regex patterns and keyword matching:

| Intent | Example Queries |
|--------|----------------|
| `frame_summary` | "分析当前帧", "帧概览" |
| `frame_performance` | "为什么这帧这么慢", "帧性能" |
| `selected_draw_explain` | "解释这个 draw", "当前 draw 在做什么" |
| `shader_analysis` | "shader 为什么慢", "着色器分析" |
| `pipeline_analysis` | "pipeline state", "渲染管线分析" |
| `resource_trace` | "这个纹理从哪来", "资源追踪" |
| `project_mapping` | "对应哪段代码", "owner 在哪" |
| `regression_compare` | "对比两个 capture", "回归分析" |
| `graphics_playbook` | Run a built-in debug playbook |

High-confidence detections (≥0.8) **auto-switch** to Graphics Mode. Medium confidence (≥0.5) triggers a **mode switch suggestion** to the user. Temporary mode switching reverts after the analysis completes.

### Provider Abstraction

Graphics providers are abstracted behind the [`GraphicsCaptureProvider`](src/services/graphics-provider/GraphicsCaptureProvider.ts) interface, defined with **13 capability flags**:

```
frameSummary  selectionContext  eventDetails  pipelineState  shaderInfo
shaderSource  meshData          resourceDetail textureData    bufferData
passGraph     projectMapping    captureDiff
```

The [`GraphicsProviderRegistry`](src/services/graphics-provider/GraphicsProviderRegistry.ts) handles:
- **Provider discovery** — find available providers
- **Capability matching** — auto-select providers that satisfy workflow requirements
- **Preflight checks** — verify capability requirements before workflow execution
- **Error normalization** — structured errors with user-friendly messages

### RenderDoc for VS Code Integration

The [`RenderDocVsCodeMcpProvider`](src/services/graphics-provider/providers/renderdoc-vscode-mcp/RenderDocVsCodeMcpProvider.ts) bridges `renderdoc-for-vscode` MCP server with Vertex's graphics workflow layer.

```
RenderDoc MCP Tools → Provider Methods
  renderdoc_openCapture          → openCurrentCapture()
  renderdoc_getFrameSummary      → getFrameSummary()
  renderdoc_getSelectionContext  → getSelectionContext()
  renderdoc_getEventDetails      → getEventDetails(eventId)
  renderdoc_getPipelineState     → getPipelineState(eventId)
  renderdoc_getShaderInfo        → getShaderInfo(request)
  renderdoc_findProjectImpl      → findProjectImplementation(request)
  renderdoc_getPassGraph         → passGraph analysis
  renderdoc_diffPipelineState    → captureDiff
  … and more
```

This integration enables the agent to:
- **Analyze render passes** — identify expensive passes and hot events
- **Inspect draw calls** — pipeline state, shader metadata, mesh data
- **Map captures to code** — find which source files own a shader or draw call
- **Run debug playbooks** — structured investigation of black screen, GPU slow, heavy shader, and shadow issues
- **Compare captures** — regression analysis between captures

### Graphics Skills

Graphics skills are specialized skill packages available in **Graphics Mode**. When loaded, they provide structured workflows for common graphics tasks:

| Skill | Description |
|-------|-------------|
| `write-shader` | Guided shader authoring (HLSL, GLSL, WGSL, MSL) with platform awareness |
| `rendering-pipeline` | Pipeline design and modification workflows |
| `graphics-debug` | Structured debugging using built-in playbooks |
| `graphics-optimization` | GPU performance analysis and optimization strategies |

Skills are loaded on-demand via the skill system — the model evaluates the user's request against available skill descriptions and selects the most appropriate one.

### Built-in Debug Playbooks

For common graphics issues, the system provides **structured debug playbooks** that guide the investigation:

| Playbook | Target Issue |
|----------|-------------|
| [`black_screen`](src/services/graphics-agent/playbooks/blackScreen.ts) | Nothing renders — empty frame |
| [`gpu_slow`](src/services/graphics-agent/playbooks/gpuSlow.ts) | Frame time exceeds target FPS |
| [`heavy_shader`](src/services/graphics-agent/playbooks/heavyShader.ts) | Shader instruction count or complexity |
| [`shadow_issue`](src/services/graphics-agent/playbooks/shadowIssue.ts) | Shadow artifacts, incorrect shadows |

Each playbook produces structured output in this format:
```
Conclusion → Evidence (with source attribution) → Suspected Issues → Next Steps
```

---

## Skills & Skill Market

The **Skill Market** is the distribution system for mode-aware skill packages. Skills define structured workflows that the agent can load on demand, extending its capabilities beyond the base system prompt.

```
Skill Market (marketplace/)
  ├── SkillInstaller.ts     — Install skills from marketplace
  ├── MarketplaceManager.ts — Browse and discover skills
  └── ConfigLoader.ts       — Load skill configurations

Skills Engine (skills/)
  ├── SkillsManager.ts      — Mode-aware skill resolution
  └── skillInvocation.ts    — Skill execution and context loading

Prompt Integration (core/prompts/sections/skills.ts)
  └── Dynamically injects <available_skills> into system prompt
```

### Skill Lifecycle

1. **Discovery** — Skills are available via the Skill Market or installed locally
2. **Filtering** — [`SkillsManager.getSkillsForMode()`](src/services/skills/SkillsManager.ts) filters skills to only those relevant to the active mode
3. **Injection** — [`getSkillsSection()`](src/core/prompts/sections/skills.ts) generates an `<available_skills>` XML block in the system prompt
4. **On-Demand Loading** — The model evaluates skills against the user's request and loads exactly one matching skill
5. **Execution** — Skill instructions take over the conversation flow until completion

This design ensures skills are **discoverable but not noisy** — the agent knows what's available but only loads what it needs.

---

## Core Modes

| Mode | Role | Tool Groups | Best For |
|------|------|-------------|----------|
| **Code** | Full-stack engineer | read, edit, terminal, search | Feature implementation, bug fixing |
| **Architect** | Senior architect | read, search | Planning, analysis, code review |
| **Ask** | Knowledge assistant | read | Quick Q&A, learning |
| **Graphics** | Graphics engineer | read, edit, command, mcp, skills | Shader writing, GPU debugging, rendering |

### Custom Modes

Define your own in VS Code `settings.json`:

```json
{
  "vertex.customModes": [
    {
      "slug": "debugger",
      "name": "Debugger",
      "roleDefinition": "You are an expert debugger. Diagnose root causes and suggest fixes.",
      "customInstructions": "Focus on identifying root causes rather than symptoms.",
      "toolGroups": ["read", "terminal", "search"]
    }
  ]
}
```

**Merge rules:**
- Same `slug` as a built-in mode → **overrides** it
- New `slug` → **appended** to the mode list
- Custom modes take **precedence** during lookup

---

## Monorepo Structure

```
vertex-code/
├── src/                         # VS Code extension (published as "vertex")
│   ├── extension.ts             # Extension entry point
│   ├── activate/                # Activation wiring (commands, URIs, code actions)
│   ├── api/
│   │   ├── providers/           # Provider-specific handlers
│   │   └── transform/           # Format adapters + caching + stream processing
│   ├── core/
│   │   ├── task/                # Task engine — agent runtime
│   │   ├── webview/             # ClineProvider — webview lifecycle
│   │   ├── prompts/             # System prompt assembly + skills injection
│   │   ├── tools/               # Tool execution & result handling
│   │   ├── diff/                # Diff strategies (search/replace, edits)
│   │   ├── config/              # Configuration & context proxy
│   │   ├── condense/            # Conversation summarization
│   │   ├── auto-approval/       # Automatic tool approval
│   │   └── context/             # Context window management
│   ├── services/
│   │   ├── graphics-agent/      # Graphics intent, mode, workflows, playbooks
│   │   ├── graphics-provider/   # Provider abstraction + RenderDoc MCP adapter
│   │   ├── marketplace/         # Skill Market — install, browse, discover
│   │   ├── skills/              # Skills engine — resolution, invocation
│   │   ├── mcp/                 # MCP server management & hub
│   │   ├── checkpoints/         # File checkpoint & restore
│   │   ├── code-index/          # Workspace code indexing
│   │   ├── mode-handoff/        # Cross-mode task delegation
│   │   └── vertex-auth/         # Session authentication
│   ├── integrations/
│   │   ├── terminal/            # Terminal process management
│   │   ├── editor/              # Diff view, decorations
│   │   └── workspace/           # Workspace tracking
│   ├── shared/                  # Shared types & utilities
│   │   ├── modes.ts             # Mode definitions & lookup
│   │   └── tools.ts             # Tool group definitions
│   └── i18n/                    # Internationalization
├── packages/
│   ├── core/                    # Shared core logic
│   ├── types/                   # TypeScript definitions (@roo-code/types)
│   ├── ipc/                     # Inter-process communication
│   ├── vscode-shim/             # VS Code API shim for testing
│   ├── config-eslint/           # Shared ESLint configs
│   └── config-typescript/       # Shared TS configs
├── webview-ui/                  # React chat UI (Vite + TypeScript)
└── locales/                     # Community translations (20+ languages)
```

---

## Quick Start

### Prerequisites

- **Node.js** `20.20.2`
- **pnpm** `10.8.1`
- **VS Code** `^1.84.0`

### Install & Run

```bash
git clone https://github.com/Kirkice/Vertex-Code.git
cd Vertex-Code
pnpm install
pnpm build
# Press F5 in VS Code to launch Extension Development Host
```

### Common Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages and extension |
| `pnpm test` | Run all test suites (Vitest) |
| `pnpm lint` | Lint with ESLint 9 |
| `pnpm check-types` | Type-check with TypeScript 5.8 |
| `pnpm bundle` | Production bundle with esbuild |
| `pnpm vsix` | Package into `.vsix` installer |
| `pnpm clean` | Clean all build artifacts |
| `pnpm install:vsix` | Full install + bundle + VSIX |

### Development

The extension supports **auto-reload** in development mode — changes to `src/**/*.ts` or `packages/types/**/*.ts` trigger an automatic window reload via `workbench.action.reloadWindow`.

---

## Technology Stack

| Area | Technology |
|------|-----------|
| **Language** | TypeScript 5.8 |
| **Runtime** | Node.js 20, VS Code 1.84+ |
| **Package Manager** | pnpm 10.8 |
| **Monorepo** | Turborepo 2.5 |
| **Extension Build** | esbuild 0.28 |
| **UI** | React 18, Vite 8 |
| **Testing** | Vitest |
| **Linting** | ESLint 9 + Prettier |
| **AI Providers** | Anthropic, OpenAI, Gemini, OpenRouter, Mistral, DeepSeek, Bedrock, Vertex AI, minimax, ZAI, VSCode LM |

---

## License

[Apache License 2.0](LICENSE)

---

<p align="center">
  <sub>Built with ❤️ for the VS Code community</sub>
</p>
