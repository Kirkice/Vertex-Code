import { createPainter } from "./theme.js"
import { parseInputChunk } from "./input.js"
import { parseTuiCommand } from "./commands.js"
import { createInitialTuiState, reduceTuiEvent } from "./state.js"
import { renderTui } from "./view.js"
import { runHeadlessSession } from "../session.js"

/**
 * TUI 控制器只负责协调输入、session 事件和终端资源。
 * 视图与状态转换保持纯函数，便于后续替换为更复杂的终端组件。
 */
export async function runTui(cwd: string): Promise<number> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return 2
  const painter = createPainter(!process.env.NO_COLOR)
  const input = createInputBuffer()
  let state = createInitialTuiState(cwd)
  let stopped = false
  let sessionTask: Promise<void> | undefined
  const controller = new AbortController()

  const draw = () => {
    process.stdout.write("\u001b[2J\u001b[H")
    process.stdout.write(renderTui(state, painter, input.value))
  }
  const startTask = (prompt: string) => {
    state = { ...state, userMessages: [...state.userMessages, prompt], assistantText: "", thinking: "", tools: [], approval: undefined }
    sessionTask = (async () => {
      for await (const event of runHeadlessSession({ cwd, prompt, yolo: false, signal: controller.signal })) {
        state = reduceTuiEvent(state, event)
        draw()
      }
    })()
  }
  const onData = (chunk: string) => {
    for (const action of parseInputChunk(chunk)) {
      if (action.type === "cancel") {
        if (state.status === "running" || state.status === "waiting_approval") controller.abort()
        else stopped = true
      } else if (action.type === "text") input.value += action.value
      else if (action.type === "backspace") input.value = input.value.slice(0, -1)
      else if (action.type === "approve") input.value = ""
      else if (action.type === "submit") {
        const value = input.value.trim()
        input.value = ""
        if (value.startsWith("/")) {
          const command = parseTuiCommand(value)
          if (command?.type === "exit") stopped = true
          else if (command?.type === "new") state = createInitialTuiState(cwd)
          else state = { ...state, notification: command ? `/${command.type} 已接收` : "未知命令，请输入 /help" }
        } else if (value && !sessionTask) startTask(value)
      }
      draw()
    }
  }

  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding("utf8")
  process.stdin.on("data", onData)
  process.stdout.write("\u001b[?1049h\u001b[?25l")
  draw()
  while (!stopped) await new Promise((resolve) => setTimeout(resolve, 50))
  controller.abort()
  await sessionTask?.catch(() => undefined)
  process.stdin.off("data", onData)
  process.stdin.setRawMode(false)
  process.stdout.write("\u001b[?25h\u001b[?1049l\n")
  return 0
}

function createInputBuffer(): { value: string } {
  return { value: "" }
}
