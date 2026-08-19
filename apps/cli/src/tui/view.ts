import type { TuiState } from "./state.js"
import type { ColorName } from "./theme.js"

type Painter = Record<ColorName, (text: string) => string>

/** 纯函数布局，保持“Vertex Code 任务面板”的层次：头部、会话、工具、审批、输入栏。 */
export function renderTui(state: TuiState, paint: Painter, input: string): string {
  const width = Math.max(48, Math.min(100, process.stdout.columns || 80))
  const line = paint.border("─".repeat(width - 2))
  const rows = [
    paint.primary(" Vertex Code ") + paint.muted(` JellyFish • ${state.cwd}`),
    line,
    ...state.userMessages.map((message) => `${paint.primary("你 >")} ${message}`),
    ...(state.assistantText ? [paint.info("Vertex") + `\n${state.assistantText}`] : []),
    ...(state.thinking && state.thinkingExpanded ? [paint.purple(`思考：${state.thinking}`)] : []),
    ...state.tools.map((tool) => `${paint.cyan("◈ Tool")} ${tool.name} ${tool.status === "completed" ? paint.success("completed") : tool.status === "failed" ? paint.error("failed") : paint.warning(tool.status)}`),
    ...(state.approval ? [line, paint.warning(`! 需要批准：${state.approval.description}`), paint.muted("[y] 执行一次  [a] 始终允许  [n] 拒绝")] : []),
    line,
    `${paint.primary("> ")}${input}`,
    paint.muted(`状态：${state.status} • session: ${state.sessionId ?? "new"} • /help 查看命令`),
  ]
  return rows.join("\n")
}
