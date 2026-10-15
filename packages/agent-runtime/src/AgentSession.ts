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
  AgentTodoItem,
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
  /** 待办是运行时的可变会话状态，禁止由 TUI 直接持有唯一副本。 */
  private readonly todos: AgentTodoItem[]
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
            // 异步宿主提示词在 run() 中完成初始化；这里先放置稳定的
            // runtime 默认提示词，避免构造函数变成异步 API。
            content: buildSystemPrompt(options.mode, options.todos),
          },
          { role: "user", content: options.prompt },
        ]
    this.todos = (options.todos ?? []).map((todo) => ({ ...todo }))

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
    await this.initializeSystemPrompt()
    const session: PersistedSession = {
      id: this.options.sessionId,
      cwd: this.options.cwd,
      prompt: this.options.prompt,
      startedAt: this.startedAt.toISOString(),
      events: [],
      messages: this.messages,
      todos: this.todos,
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
      todos: this.todos,
      cost: this.cost,
    })
  }

  private async initializeSystemPrompt(): Promise<void> {
    if (!this.options.buildSystemPrompt || this.options.initialMessages) return
    const system = await this.options.buildSystemPrompt({
      cwd: this.options.cwd,
      mode: this.options.mode,
      todos: this.todos,
    })
    const systemMessage = this.messages.find((message) => message.role === "system")
    if (systemMessage) systemMessage.content = system
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
      if (await this.compactContext()) {
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
        tools: this.definitions(),
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
        const queued = await this.options.messageQueue?.drain()
        if (queued?.length) {
          this.messages.push(...queued)
          continue
        }
        return assistantText || "模型未返回可显示的最终回复。"
      }

      for (const call of calls) {
        yield* this.executeTool(call)
      }
    }

    throw new AgentRuntimeError("RUNTIME_ERROR", `工具调用轮次超过上限（${maxTurns}），会话已安全终止。`)
  }

  private async *executeTool(call: AgentToolCall): AsyncGenerator<RooCliStreamEvent> {
    const definition = this.definitions().find((item) => item.name === call.name)
    if (!definition) {
      throw new AgentRuntimeError("RUNTIME_ERROR", `模型请求了未注册工具：${call.name}`)
    }
    // 模式的工具清单是运行时安全边界，而不仅是给模型的提示词。即便模型忽略
    // system prompt，也不能借由工具调用越过当前模式的能力范围。
    const allowedTools = this.options.mode?.allowedTools
    if (allowedTools?.length && call.name !== "update_todo" && !allowedTools.includes(call.name)) {
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
      const execution: { output: string; exitCode?: number } = call.name === "update_todo"
        ? this.updateTodo(call)
        : await this.options.tools.execute(call, {
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

  /** 合并宿主工具和 runtime 内建工具，避免待办能力依附某个具体 Host。 */
  private definitions() {
    return [
      ...this.options.tools.definitions(),
      {
        name: "update_todo",
        description: "创建或更新当前任务的待办项。status 只能为 pending、in_progress 或 completed。",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "待办稳定标识；已存在时更新该项" },
            content: { type: "string", description: "待办内容" },
            status: { type: "string", enum: ["pending", "in_progress", "completed"] },
          },
          required: ["id", "content", "status"],
        },
        requiresApproval: false,
        risk: "low" as const,
      },
    ]
  }

  /** 仅接受严格的待办字段，防止模型将任意对象写入可恢复的会话快照。 */
  private updateTodo(call: AgentToolCall): { output: string } {
    const id = stringInput(call.input.id, "id")
    const content = stringInput(call.input.content, "content")
    const rawStatus = call.input.status
    if (rawStatus !== "pending" && rawStatus !== "in_progress" && rawStatus !== "completed") {
      throw new Error("工具参数 status 必须是 pending、in_progress 或 completed。")
    }
    const status: AgentTodoItem["status"] = rawStatus
    const next = { id, content, status }
    const index = this.todos.findIndex((todo) => todo.id === id)
    if (index >= 0) this.todos[index] = next
    else this.todos.push(next)
    return { output: `待办已更新：${status} ${content}` }
  }

  private throwIfAborted(): void {
    if (this.abortController.signal.aborted) {
      throw new AgentRuntimeError("CANCELLED", "任务已取消。")
    }
  }

  /**
   * 按 token 预算压缩上下文，同时保留 system、最近一轮和工具调用链。
   * 消息数量限制只作为旧配置的兼容兜底，避免长工具输出绕过限制。
   */
  private async compactContext(): Promise<boolean> {
    const messageLimit = this.options.maxContextMessages ?? Number.POSITIVE_INFINITY
    const modelLimit = this.options.provider.contextWindowTokens
    const configuredLimit = this.options.maxContextTokens
    const inputLimit = configuredLimit ?? (modelLimit ? Math.max(1, modelLimit - (this.options.responseReserveTokens ?? 2048)) : Number.POSITIVE_INFINITY)
    const estimate = this.options.estimateTokens ?? estimateTextTokens
    const totalTokens = this.messages.reduce((sum, message) => sum + estimateMessageTokens(message, estimate), 0)
    if (this.messages.length <= messageLimit && totalTokens <= inputLimit) return false

    const system = this.messages[0]
    const summary = system && this.messages.length > 1
      ? { role: "system" as const, content: "历史摘要：已省略较早消息；请以当前上下文为准。" }
      : undefined
    const kept: AgentMessage[] = []
    let used = (system ? estimateMessageTokens(system, estimate) : 0) + (summary ? estimateMessageTokens(summary, estimate) : 0)
    for (let index = this.messages.length - 1; index >= (system ? 1 : 0); index -= 1) {
      const message = this.messages[index]
      if (!message) continue
      const tokens = estimateMessageTokens(message, estimate)
      if (kept.length > 0 && used + tokens > inputLimit) break
      kept.unshift(message)
      used += tokens
    }
    this.messages.splice(0, this.messages.length, ...(system ? [system, ...(summary ? [summary] : []), ...kept] : kept))
    return true
  }

  private errorCode(error: unknown): RooCliErrorCode {
    if (error instanceof AgentRuntimeError) return error.code
    if (this.abortController.signal.aborted) return "CANCELLED"
    return "RUNTIME_ERROR"
  }
}

function estimateMessageTokens(message: AgentMessage, estimate: (text: string) => number): number {
  return estimate(message.content) + (message.toolCalls?.reduce((sum, call) => sum + estimate(call.name) + estimate(JSON.stringify(call.input)), 0) ?? 0)
}

/** 保守估算：中日韩文本按字符计，拉丁文本按约四字符一个 token 计。 */
function estimateTextTokens(text: string): number {
  const cjk = (text.match(/[\u2e80-\u9fff\uf900-\ufaff]/g) ?? []).length
  const other = text.length - cjk
  return Math.max(1, cjk + Math.ceil(other / 4))
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

function stringInput(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`工具参数 ${name} 必须是非空字符串。`)
  return value.trim()
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
