import {
  rooCliProtocol,
  rooCliSchemaVersion,
  type RooCliApprovalRequest,
  type RooCliCost,
  type RooCliErrorCode,
  type RooCliStreamEvent,
} from "@roo-code/types"

import type {
  AgentMessage,
  AgentMode,
  AgentSessionOptions,
  AgentSessionResult,
  AgentToolCall,
  ModelUsage,
  PersistedSession,
} from "./contracts.js"

/**
 * 无 UI 的 Agent 状态机。
 *
 * 该类唯一的输出是有序事件流：调用方可将它渲染为文本、JSON 或 TUI；
 * 所有有副作用的能力均通过端口注入，所以运行时本身不依赖 Node 或 VS Code。
 */
export class AgentSession {
  private readonly abortController = new AbortController()
  private readonly startedAt: Date
  private readonly now: () => Date
  private readonly events: RooCliStreamEvent[] = []
  private readonly messages: AgentMessage[]
  private readonly cost: RooCliCost = {}
  private toolCalls = 0

  constructor(private readonly options: AgentSessionOptions) {
    this.now = options.now ?? (() => new Date())
    this.startedAt = this.now()
    this.messages = options.initialMessages
      ? options.initialMessages.map((message) => ({
          ...message,
          toolCalls: message.toolCalls?.map((call) => ({ ...call, input: { ...call.input } })),
        }))
      : [
          {
            role: "system",
            content: buildSystemPrompt(options.mode, options.todos),
          },
          { role: "user", content: options.prompt },
        ]

    // 外部取消和内部取消共用同一个 signal，确保模型流和子进程能同时中止。
    if (options.signal?.aborted) {
      this.abortController.abort(options.signal.reason)
    } else {
      options.signal?.addEventListener("abort", () => this.abortController.abort(options.signal?.reason), { once: true })
    }
  }

  cancel(reason = "用户取消任务"): void {
    this.abortController.abort(reason)
  }

  async *run(): AsyncGenerator<RooCliStreamEvent> {
    const session: PersistedSession = {
      id: this.options.sessionId,
      cwd: this.options.cwd,
      prompt: this.options.prompt,
      startedAt: this.startedAt.toISOString(),
      events: [],
      messages: this.messages,
    }

    await this.options.store.create(session)
    yield* this.emit({
      type: "system",
      subtype: "session_started",
      sessionId: this.options.sessionId,
      content: `Headless Agent 会话已启动：${this.options.cwd}`,
      protocol: rooCliProtocol,
      schemaVersion: rooCliSchemaVersion,
      capabilities: ["tools", "approvals", "persistence"],
    })

    let code: RooCliErrorCode | undefined
    let content = ""
    let success = false

    try {
      content = yield* this.runTurns()
      success = true
    } catch (error) {
      code = this.errorCode(error)
      content = error instanceof Error ? error.message : String(error)
      yield* this.emit({ type: "error", code, content, sessionId: this.options.sessionId })
    }

    const durationMs = this.now().getTime() - this.startedAt.getTime()
    const result: RooCliStreamEvent = {
      type: "result",
      done: true,
      success,
      code,
      content,
      sessionId: this.options.sessionId,
      cost: this.cost,
      summary: {
        sessionId: this.options.sessionId,
        durationMs,
        toolCalls: this.toolCalls,
        cancelled: code === "CANCELLED",
      },
    }
    yield* this.emit(result)

    await this.options.store.complete(this.options.sessionId, {
      finishedAt: this.now().toISOString(),
      success,
      code,
      messages: this.messages,
      cost: this.cost,
    })
  }

  /** 为 JSON 输出模式提供已收集的最终输出。必须在 run() 完成后调用。 */
  finalOutput(): AgentSessionResult {
    const result = [...this.events].reverse().find((event) => event.type === "result")
    return {
      type: "result",
      success: result?.success ?? false,
      content: result?.content,
      code: result?.code as RooCliErrorCode | undefined,
      sessionId: this.options.sessionId,
      cost: this.cost,
      summary: result?.summary,
      events: this.events,
    }
  }

  private async *runTurns(): AsyncGenerator<RooCliStreamEvent, string> {
    const maxTurns = this.options.maxTurns ?? 12

    for (let turn = 0; turn < maxTurns; turn += 1) {
      this.throwIfAborted()
      if (this.compactContext()) {
        yield* this.emit({
          type: "system",
          subtype: "context_compacted",
          sessionId: this.options.sessionId,
          content: `上下文已压缩为 ${this.messages.length} 条消息。`,
        })
      }
      let assistantText = ""
      const calls: AgentToolCall[] = []

      for await (const event of this.options.provider.stream({
        messages: this.messages,
        tools: this.options.tools.definitions(),
        signal: this.abortController.signal,
      })) {
        this.throwIfAborted()
        if (event.type === "text_delta") {
          assistantText += event.text
          yield* this.emit({ type: "assistant", subtype: "delta", content: event.text, sessionId: this.options.sessionId })
        } else if (event.type === "tool_call") {
          calls.push(event.toolCall)
        } else if (event.type === "usage") {
          this.mergeUsage(event.usage)
        }
      }

      if (assistantText || calls.length > 0) {
        this.messages.push({
          role: "assistant",
          content: assistantText,
          toolCalls: calls.length > 0 ? calls : undefined,
        })
      }

      if (calls.length === 0) {
        return assistantText || "模型未返回可显示的最终回复。"
      }

      for (const call of calls) {
        yield* this.executeTool(call)
      }
    }

    throw new AgentRuntimeError("RUNTIME_ERROR", `工具调用轮次超过上限（${maxTurns}），会话已安全终止。`)
  }

  private async *executeTool(call: AgentToolCall): AsyncGenerator<RooCliStreamEvent> {
    const definition = this.options.tools.definitions().find((item) => item.name === call.name)
    if (!definition) {
      throw new AgentRuntimeError("RUNTIME_ERROR", `模型请求了未注册工具：${call.name}`)
    }
    // 模式的工具清单是运行时安全边界，而不仅是给模型的提示词。即便模型忽略
    // system prompt，也不能借由工具调用越过当前模式的能力范围。
    const allowedTools = this.options.mode?.allowedTools
    if (allowedTools?.length && !allowedTools.includes(call.name)) {
      throw new AgentRuntimeError("APPROVAL_DENIED", `当前模式不允许调用工具：${call.name}`)
    }

    this.toolCalls += 1
    yield* this.emit({
      type: "tool_use",
      subtype: "requested",
      sessionId: this.options.sessionId,
      tool_use: { name: call.name, input: call.input },
    })

    if (definition.requiresApproval) {
      const approval: RooCliApprovalRequest = {
        id: call.id,
        operation: call.name,
        description: `模型请求执行 ${call.name}`,
        cwd: this.options.cwd,
        risk: definition.risk,
      }
      yield* this.emit({ type: "tool_use", subtype: "approval_required", sessionId: this.options.sessionId, approval })
      const decision = await this.options.approvals.resolve(approval, this.abortController.signal)
      if (decision === "deny") {
        throw new AgentRuntimeError("APPROVAL_DENIED", `操作已被拒绝：${call.name}`)
      }
    }

    yield* this.emit({ type: "tool_use", subtype: "running", sessionId: this.options.sessionId, tool_use: { name: call.name, input: call.input } })
    try {
      const execution = await this.options.tools.execute(call, {
        cwd: this.options.cwd,
        signal: this.abortController.signal,
      })
      this.messages.push({ role: "tool", name: call.name, toolCallId: call.id, content: execution.output })
      yield* this.emit({
        type: "tool_result",
        subtype: "completed",
        sessionId: this.options.sessionId,
        tool_result: { name: call.name, output: execution.output, exitCode: execution.exitCode },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.messages.push({ role: "tool", name: call.name, toolCallId: call.id, content: `工具失败：${message}` })
      yield* this.emit({
        type: "tool_result",
        subtype: "failed",
        sessionId: this.options.sessionId,
        tool_result: { name: call.name, error: message },
      })
    }
  }

  private async *emit(event: RooCliStreamEvent): AsyncGenerator<RooCliStreamEvent> {
    this.events.push(event)
    await this.options.store.appendEvent(this.options.sessionId, event)
    yield event
  }

  private mergeUsage(usage: ModelUsage): void {
    this.cost.inputTokens = (this.cost.inputTokens ?? 0) + (usage.inputTokens ?? 0)
    this.cost.outputTokens = (this.cost.outputTokens ?? 0) + (usage.outputTokens ?? 0)
    this.cost.totalCost = (this.cost.totalCost ?? 0) + (usage.totalCost ?? 0)
  }

  private throwIfAborted(): void {
    if (this.abortController.signal.aborted) {
      throw new AgentRuntimeError("CANCELLED", "任务已取消。")
    }
  }

  /**
   * 确定性滑动窗口压缩，保证长会话不会无限增长。
   * system 消息永远保留；后续可以通过独立摘要 Provider 替换此策略。
   */
  private compactContext(): boolean {
    const limit = this.options.maxContextMessages ?? 80
    if (this.messages.length <= limit) return false
    const system = this.messages[0]
    const recent = this.messages.slice(-(limit - 1))
    this.messages.splice(0, this.messages.length, ...(system ? [system, ...recent] : recent))
    return true
  }

  private errorCode(error: unknown): RooCliErrorCode {
    if (error instanceof AgentRuntimeError) return error.code
    if (this.abortController.signal.aborted) return "CANCELLED"
    return "RUNTIME_ERROR"
  }
}

function buildSystemPrompt(mode: AgentMode | undefined, todos: AgentSessionOptions["todos"]): string {
  const sections = [
    mode?.roleDefinition ?? "你是 Vertex 编程助手。",
    "需要读取、列出、写入文件或执行命令时，必须调用已提供的工具。完成任务后给出简洁中文总结。",
  ]
  if (mode?.customInstructions) sections.push(`项目附加指令：\n${mode.customInstructions}`)
  if (mode?.allowedTools?.length) sections.push(`允许使用的工具：${mode.allowedTools.join(", ")}`)
  if (todos?.length) sections.push(`当前待办：\n${todos.map((todo) => `- [${todo.status}] ${todo.content}`).join("\n")}`)
  return sections.join("\n\n")
}

export class AgentRuntimeError extends Error {
  constructor(
    readonly code: RooCliErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "AgentRuntimeError"
  }
}
