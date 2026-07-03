# Vertex Code

> A compact VS Code extension project for understanding how custom AI modes are modeled, merged, and surfaced inside a modern agent workflow.

`Vertex Code` is a focused learning project. It distills the core ideas behind **Custom Modes** into a small, readable VS Code extension so you can study the mechanics without wading through a much larger production codebase.

It is designed for people who want to understand:

- how a mode is defined
- how built-in and user-defined modes are merged
- how tool permissions shape agent behavior
- how a system prompt is assembled from mode data
- how those ideas are exposed through a lightweight VS Code chat UI

## Why This Project

Large AI coding products often hide their most interesting ideas behind a lot of infrastructure. This repo intentionally goes the other direction.

It keeps the surface area small, the file boundaries clear, and the concepts visible. Instead of simulating an entire agent platform, it focuses on one powerful abstraction:

**a mode is a reusable behavioral contract**

That contract combines:

- a role definition
- extra instructions
- a tool permission set
- a prompt assembly strategy

## Highlights

- **Custom Modes**  
  Define your own modes in `settings.json` with `slug`, `name`, `roleDefinition`, `customInstructions`, and `toolGroups`.

- **Mode Switching UI**  
  Switch between built-in and custom modes from the extension UI and immediately see how the active behavior changes.

- **Prompt Preview**  
  Inspect the final assembled system prompt, including role definition, custom instructions, tool descriptions, and mode constraints.

- **Minimal, Study-Friendly Architecture**  
  The project is intentionally small enough to trace end-to-end.

- **Vertex-Aligned Concepts**  
  The implementation mirrors the shape of a real mode-driven agent system closely enough to be educational, while staying approachable.

## Built-In Modes

| Mode | Tool Groups | Purpose |
| --- | --- | --- |
| `Code` | `read`, `edit`, `terminal`, `search`, `browser` | Full coding workflow |
| `Architect` | `read`, `search` | Planning, analysis, structure, no file edits |
| `Ask` | `read` | Lightweight Q&A mode |

## How It Works

At a high level, the extension follows a simple flow:

1. Load built-in modes.
2. Read user-defined modes from VS Code settings.
3. Merge them using override-or-append rules.
4. Resolve the active mode.
5. Expand tool-group permissions into concrete capability descriptions.
6. Assemble the final system prompt.
7. Show the result inside the chat panel.

This makes the repo useful both as a teaching aid and as a starting point for your own experiments.

## Custom Mode Example

Add your own mode in VS Code `settings.json`:

```json
{
  "miniModes.customModes": [
    {
      "slug": "debugger",
      "name": "Debugger",
      "roleDefinition": "You are an expert debugger. You can read files, search the codebase, and execute terminal commands to help diagnose and fix bugs.",
      "customInstructions": "Focus on identifying root causes rather than symptoms.",
      "toolGroups": ["read", "terminal", "search"]
    }
  ],
  "miniModes.apiKey": "",
  "miniModes.apiModel": "gpt-4o-mini"
}
```

### Merge Rules

- If a custom mode uses the same `slug` as a built-in mode, it **overrides** it.
- If a custom mode uses a new `slug`, it is **added** to the mode list.
- During lookup, custom definitions take precedence.

## Project Structure

```text
src/
  extension.ts          VS Code entrypoint
  types/
    modes.ts            Mode types and built-in mode definitions
  core/
    modes.ts            Mode lookup, merge, and summary logic
    tools.ts            Tool-group definitions
    prompt.ts           System prompt assembly
  webview/
    ChatPanel.ts        Webview lifecycle and message bridge

webview-ui/
  index.html            Chat UI shell
  main.js               Frontend interaction logic
  style.css             UI styling
```

## Files Worth Reading First

If you want the fastest path through the codebase, start here:

- `src/types/modes.ts`
- `src/core/tools.ts`
- `src/core/modes.ts`
- `src/core/prompt.ts`
- `src/extension.ts`

Together, these files explain most of the system.

## Development

### Prerequisites

- Node.js `20.20.2`
- VS Code `^1.84.0`
- `pnpm` `10.8.1`

### Common Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

If you are working on the extension itself:

```bash
pnpm bundle
pnpm vsix
```

### Run In VS Code

1. Open the project in VS Code.
2. Run `pnpm install`.
3. Press `F5`.
4. In the Extension Development Host, run `Mini Modes: Open Chat`.

## What This Project Is And Is Not

This project **is**:

- a clean reference for mode-driven prompt assembly
- a small VS Code extension for experimentation
- a teaching-oriented implementation

This project **is not**:

- a full production agent platform
- a complete clone of Vertex internals
- an opinionated end-user chat product

## License

See [LICENSE](LICENSE).
