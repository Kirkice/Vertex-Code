# Vertex Code

> A mode-driven AI coding agent for VS Code, combining model routing, tool execution, code intelligence, recoverable tasks, and graphics debugging in one engineering workflow.

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

## Overview

Vertex Code is a VS Code extension for executing engineering tasks with an AI agent rather than only chatting about code. A task can inspect a workspace, build context, call models and tools, edit files, run commands, preserve checkpoints, and recover from interruptions.

The repository contains:

- A VS Code Extension Host under [`src/`](src/extension.ts:111).
- A React Webview under [`webview-ui/`](webview-ui/package.json:1).
- Shared workspace packages under [`packages/`](packages/types/src/graphics.ts:1).
- Protocol, configuration, graphics, and development documentation under [`schemas/`](schemas/roomodes.json:1), [`docs/`](docs/graphics-agent-unified-roadmap.md:1), and [`plans/`](plans/graphics-agent-development-roadmap.md:1).

## Capabilities

### Agent modes

Modes define an agent's role, instructions, tools, and execution boundaries. Built-in modes include:

- **Code** — implement, refactor, test, and debug software.
- **Architect** — analyze requirements and design implementation plans.
- **Ask** — explain code and technical concepts.
- **Debug** — investigate failures and identify root causes.
- **Graphics** — analyze shaders, captures, GPU workloads, and rendering pipelines.
- **Translate** — maintain localization resources.
- **Issue / PR** — work through GitHub issue and pull-request workflows.
- **Docs Extractor** — produce documentation material from the codebase.

Modes can be extended through project or user configuration. Mode definitions and routing are implemented around [`src/shared/modes/`](src/shared/modes/index.ts:1) and [`src/services/mode-routing/ModeRoutingResolver.ts`](src/services/mode-routing/ModeRoutingResolver.ts:34).

### Model and provider routing

The provider layer normalizes model APIs, streaming responses, format transforms, reasoning content, token usage, and cost information. Vertex Code can use hosted or local providers, including OpenAI-compatible services, Anthropic, Gemini, Vertex AI, Bedrock, Mistral, DeepSeek, xAI, Ollama, LM Studio, and the VS Code Language Model API.

You can use one model for a task or route different modes to different provider profiles. For example, Architect can use a reasoning model, Code can use a coding model, and Graphics can use a model suited to shader or visual analysis.

### Tools and MCP

The agent can work with real project state through structured tools:

- Read, search, create, edit, and delete files.
- Apply precise diffs and inspect changes.
- Run terminal commands with approval and timeout controls.
- Use MCP servers, tools, and resources.
- Install and execute Skills.
- Create subtasks, switch modes, and maintain TODOs.
- Preserve task history, checkpoints, and recoverable execution state.

MCP integration is implemented around [`src/services/mcp/McpHub.ts`](src/services/mcp/McpHub.ts:155).

### Graphics Agent

Graphics Mode provides a provider-independent workflow for runtime graphics investigation. It supports:

- Frame performance and frame-overview analysis.
- Draw-event and pipeline inspection.
- Shader information, source, and project mapping.
- Resource history and trace analysis.
- Asset-provider integration.
- Launch Profiles for Windows and Android targets.
- Launch and Capture orchestration with progress, cancellation, and stage timeouts.
- Re-Capture Validation using baseline and candidate evidence.
- Percentage changes, performance budgets, reproducibility metadata, and investigation-session persistence.
- Runtime diagnostic caching and explicit cache invalidation.

The main extension-host components are [`GraphicsWorkflowOrchestrator`](src/services/graphics-agent/GraphicsWorkflowOrchestrator.ts:54), [`GraphicsCaptureProvider`](src/services/graphics-provider/GraphicsCaptureProvider.ts:51), [`GraphicsLaunchProfileStore`](src/services/graphics-agent/persistence/GraphicsLaunchProfileStore.ts:10), and [`RenderDocVsCodeMcpProvider`](src/services/graphics-provider/providers/renderdoc-vscode-mcp/RenderDocVsCodeMcpProvider.ts:95).

The local implementation is covered by TypeScript checks and mocked provider tests. Real RenderDoc MCP tool names and response schemas, real target-process launch, Live Target discovery, capture completion, and process cleanup still require validation in the user's Windows/Android and RenderDoc environment.

## Architecture

```text
┌────────────────────────────────────────────────────────────┐
│ VS Code Extension Host                                     │
│ src/                                                       │
│  ├─ Task and Agent runtime                                 │
│  ├─ Model providers and format transforms                  │
│  ├─ Tools, MCP, Skills, and checkpoints                    │
│  ├─ Code index and context management                      │
│  └─ Graphics workflows and capture providers               │
└──────────────────────────┬─────────────────────────────────┘
                           │ Webview message protocol
                           ▼
┌────────────────────────────────────────────────────────────┐
│ React Webview                                              │
│ webview-ui                                                 │
│  ├─ Chat, task, settings, and history UI                   │
│  ├─ Provider, model, Skill, and MCP management              │
│  └─ Graphics planning and runtime investigation UI         │
└────────────────────────────────────────────────────────────┘

External integrations: model APIs · MCP servers · RenderDoc · VS Code API · optional Qdrant
```

## Repository layout

```text
vertex-code/
├── src/                    # VS Code extension and Extension Host code
├── webview-ui/             # React Webview application
├── packages/               # Shared core, types, IPC, build, and test packages
├── schemas/                # Configuration and protocol schemas
├── scripts/                # Bootstrap, build, test, and release helpers
├── docs/                   # Product and technical documentation
└── plans/                  # Development roadmaps and implementation plans
```

## Requirements

- Node.js `20.20.2`.
- pnpm `10.8.1`.
- VS Code `^1.84.0`.
- Provider credentials for the model services you intend to use.
- RenderDoc for VS Code and a compatible target application only for real Graphics Capture validation.

## Quick start

```bash
git clone https://github.com/Kirkice/Vertex-Code.git
cd Vertex-Code
pnpm install
pnpm build
```

Open the repository in VS Code and press `F5` to start an Extension Development Host. Configure a model provider in the Vertex settings UI. Keep API keys in VS Code Secret Storage, environment variables, or local settings; do not commit credentials.

## Development commands

| Command | Description |
|---|---|
| `pnpm install` | Install all workspace dependencies. |
| `pnpm check-types` | Run TypeScript checks across workspaces. |
| `pnpm test` | Run the workspace test suites. |
| `pnpm lint` | Run ESLint. |
| `pnpm format` | Format supported source files with Prettier. |
| `pnpm build` | Build all workspace packages. |
| `pnpm bundle` | Build the extension bundle. |
| `pnpm vsix` | Package a VS Code `.vsix`. |
| `pnpm clean` | Remove build output and local caches. |

Workspace-specific scripts are declared in [`src/package.json`](src/package.json:462) and [`webview-ui/package.json`](webview-ui/package.json:6). Focused tests can be run from the relevant workspace with Vitest, for example:

```bash
pnpm --dir src exec pnpm exec vitest run src/services/graphics-agent/__tests__
```

## Configuration and security

Extension settings are declared in [`src/package.json`](src/package.json:307). They cover provider profiles, model routing, approvals, custom modes, Skills, MCP, code indexing, timeouts, debug proxies, and storage paths.

Before committing changes:

- Keep `.env` files, API keys, tokens, and local credentials out of Git.
- Do not commit `node_modules`, build output, coverage, logs, Turbo caches, or TypeScript build metadata.
- Review generated files and `git diff --check` before pushing.

## Project status

Vertex Code is an actively developed VS Code AI-agent project. Core local Graphics Agent workflows, contracts, persistence, caching, cancellation, timeout handling, UI controls, and mocked-provider tests are implemented. Environment-dependent RenderDoc and target-process validation is intentionally documented as a separate step rather than represented as locally verified behavior.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
