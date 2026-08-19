import type { CliStreamEvent } from "../protocol.js"

export type TuiStatus = "idle" | "running" | "waiting_approval" | "completed" | "error"

export interface TuiToolCard {
  name: string
  input?: Record<string, unknown>
  status: "requested" | "running" | "completed" | "failed"
  output?: string
  error?: string
}

export interface TuiState {
  cwd: string
  sessionId?: string
  status: TuiStatus
  userMessages: string[]
  assistantText: string
  thinking: string
  thinkingExpanded: boolean
  tools: TuiToolCard[]
  approval?: CliStreamEvent["approval"]
  cost?: CliStreamEvent["cost"]
  notification?: string
}

export function createInitialTuiState(cwd: string): TuiState {
  return { cwd, status: "idle", userMessages: [], assistantText: "", thinking: "", thinkingExpanded: false, tools: [] }
}

/** 纯事件 reducer：TUI 展示状态不包含任何 Node 或终端副作用。 */
export function reduceTuiEvent(state: TuiState, event: CliStreamEvent): TuiState {
  const next = { ...state, tools: [...state.tools], userMessages: [...state.userMessages] }
  if (event.sessionId) next.sessionId = event.sessionId
  if (event.cost) next.cost = event.cost
  if (event.type === "system" && event.subtype === "session_started") next.status = "running"
  if (event.type === "assistant") next.assistantText += event.content ?? ""
  if (event.type === "thinking") next.thinking += event.content ?? ""
  if (event.type === "tool_use" && event.tool_use) {
    const existing = next.tools.find((tool) => tool.name === event.tool_use?.name && tool.status !== "completed" && tool.status !== "failed")
    if (existing) existing.status = event.subtype === "running" ? "running" : event.subtype === "approval_required" ? "requested" : existing.status
    else next.tools.push({ name: event.tool_use.name, input: event.tool_use.input, status: event.subtype === "running" ? "running" : "requested" })
    if (event.subtype === "approval_required") {
      next.status = "waiting_approval"
      next.approval = event.approval
    }
  }
  if (event.type === "tool_result" && event.tool_result) {
    const tool = [...next.tools].reverse().find((item) => item.name === event.tool_result?.name)
    if (tool) {
      tool.status = event.subtype === "failed" ? "failed" : "completed"
      tool.output = event.tool_result.output
      tool.error = event.tool_result.error
    }
    next.approval = undefined
    next.status = "running"
  }
  if (event.type === "error") { next.status = "error"; next.notification = event.content }
  if (event.type === "result") next.status = event.success ? "completed" : "error"
  return next
}
