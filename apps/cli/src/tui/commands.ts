export type TuiCommand =
  | { type: "help" | "new" | "exit" | "compact" | "diff" }
  | { type: "resume" | "mode" | "model" | "approve" | "mcp"; value?: string }

export function parseTuiCommand(input: string): TuiCommand | undefined {
  const parts = input.trim().slice(1).split(/\s+/).filter(Boolean)
  const [name, value] = parts
  if (!name) return undefined
  if (["help", "new", "exit", "compact", "diff"].includes(name)) return { type: name as TuiCommand["type"] }
  if (["resume", "mode", "model", "approve", "mcp"].includes(name)) return { type: name as "resume" | "mode" | "model" | "approve" | "mcp", value }
  return undefined
}

export const tuiHelp = [
  "/help                 显示帮助",
  "/new                  开始新会话",
  "/resume [sessionId]   恢复会话",
  "/mode [name]          切换模式",
  "/model [name]         切换模型",
  "/approve [once|always|deny]  设置审批策略",
  "/mcp [list|refresh]    管理 MCP",
  "/compact              压缩上下文",
  "/diff                 查看当前差异",
  "/exit                 退出 Vertex Code",
].join("\n")
