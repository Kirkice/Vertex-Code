import { DeferredApprovalResolver, InMemoryMessageQueue } from "@vertex/agent-runtime"
import { ConfigStore } from "@vertex/node-host"

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
  const approvals = new DeferredApprovalResolver()
  const messageQueue = new InMemoryMessageQueue()
  const config = new ConfigStore()

  const draw = () => {
    process.stdout.write("\u001b[2J\u001b[H")
    process.stdout.write(renderTui(state, painter, input.value))
  }
  const startTask = (prompt: string) => {
    state = { ...state, userMessages: [...state.userMessages, prompt], assistantText: "", thinking: "", tools: [], approval: undefined }
    let task!: Promise<void>
    task = (async () => {
      try {
        for await (const event of runHeadlessSession({ cwd, prompt, yolo: false, signal: controller.signal, approvals, messageQueue })) {
          state = reduceTuiEvent(state, event)
          draw()
        }
      } finally {
        // Promise 完成后必须清空占用标记，否则同一个 TUI 进程无法提交第二条消息。
        if (sessionTask === task) sessionTask = undefined
      }
    })()
    sessionTask = task
  }
  const onData = (chunk: string) => {
    for (const action of parseInputChunk(chunk)) {
      if (action.type === "cancel") {
        if (state.status === "running" || state.status === "waiting_approval") controller.abort()
        else stopped = true
      } else if (action.type === "text") input.value += action.value
      else if (action.type === "backspace") input.value = input.value.slice(0, -1)
      else if (action.type === "approve") {
        const request = state.approval
        if (!request) state = { ...state, notification: "当前没有待处理的审批请求。" }
        else if (action.decision === "always_allow") persistAlwaysAllow(config, request.operation, approvals, request.id)
        else approvals.decide(request.id, action.decision)
        input.value = ""
      }
      else if (action.type === "submit") {
        const value = input.value.trim()
        input.value = ""
        if (value.startsWith("/")) {
          const command = parseTuiCommand(value)
          if (command?.type === "exit") stopped = true
          else if (command?.type === "new") state = createInitialTuiState(cwd)
          else state = { ...state, notification: command ? `/${command.type} 已接收` : "未知命令，请输入 /help" }
        } else if (value && sessionTask) {
          messageQueue.enqueue({ role: "user", content: value })
          state = { ...state, notification: "消息已排队，将在当前模型轮次结束后发送。" }
        } else if (value) startTask(value)
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
  approvals.cancelPending()
  await sessionTask?.catch(() => undefined)
  process.stdin.off("data", onData)
  process.stdin.setRawMode(false)
  process.stdout.write("\u001b[?25h\u001b[?1049l\n")
  return 0
}

function createInputBuffer(): { value: string } {
  return { value: "" }
}

/** 用户明确选择“始终允许”后才写入 allowlist，并继续当前工具调用。 */
function persistAlwaysAllow(
  config: ConfigStore,
  operation: string,
  approvals: DeferredApprovalResolver,
  requestId: string,
): void {
  void (async () => {
    const current = (await config.get()).alwaysAllowOperations ?? []
    if (!current.includes(operation)) await config.set({ alwaysAllowOperations: [...current, operation] })
    approvals.decide(requestId, "always_allow")
  })()
}
