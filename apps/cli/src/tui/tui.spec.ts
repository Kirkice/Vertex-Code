import { describe, expect, it } from "vitest"

import { parseTuiCommand } from "./commands.js"
import { parseInputChunk } from "./input.js"
import { createInitialTuiState, reduceTuiEvent } from "./state.js"
import { createPainter } from "./theme.js"
import { renderTui } from "./view.js"

describe("Vertex Code TUI", () => {
  it("parses slash commands and approval keys", () => {
    expect(parseTuiCommand("/resume abc")).toEqual({ type: "resume", value: "abc" })
    expect(parseTuiCommand("/help")).toEqual({ type: "help" })
    expect(parseInputChunk("yn")).toEqual([
      { type: "approve", decision: "approve" },
      { type: "approve", decision: "deny" },
    ])
  })

  it("reduces runtime events into tool and approval state", () => {
    let state = createInitialTuiState("/workspace")
    state = reduceTuiEvent(state, { type: "system", subtype: "session_started", sessionId: "session-1" })
    state = reduceTuiEvent(state, { type: "tool_use", subtype: "approval_required", tool_use: { name: "execute_shell", input: { command: "git status" } }, approval: { id: "1", operation: "execute_shell", description: "执行命令", cwd: "/workspace", risk: "high" } })
    expect(state.status).toBe("waiting_approval")
    expect(state.tools[0]?.name).toBe("execute_shell")
  })

  it("renders JellyFish layout with color disabled", () => {
    const output = renderTui(createInitialTuiState("/workspace"), createPainter(false), "检查项目")
    expect(output).toContain("Vertex Code")
    expect(output).toContain("JellyFish")
    expect(output).not.toContain("\u001b[")
  })
})
