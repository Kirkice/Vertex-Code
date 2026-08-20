import { describe, expect, it } from "vitest"

import { AgentSession } from "./AgentSession.js"
import type {
  AgentToolCall,
  ModelProvider,
  PersistedSession,
  SessionStore,
  ToolRegistry,
} from "./contracts.js"

class MemoryStore implements SessionStore {
  readonly sessions = new Map<string, PersistedSession>()

  async create(session: PersistedSession): Promise<void> { this.sessions.set(session.id, structuredClone(session)) }
  async appendEvent(sessionId: string, event: PersistedSession["events"][number]): Promise<void> { this.sessions.get(sessionId)?.events.push(event) }
  async complete(sessionId: string, patch: Pick<PersistedSession, "finishedAt" | "success" | "code" | "messages" | "todos" | "cost">): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`未知会话：${sessionId}`)
    Object.assign(session, patch)
  }
}

function toolRegistry(): ToolRegistry {
  return {
    definitions: () => [{ name: "read_file", description: "读取文件", parameters: {}, requiresApproval: false, risk: "low" }],
    execute: async (call: AgentToolCall) => ({ output: `执行了 ${call.name}` }),
  }
}

describe("AgentSession", () => {
  it("persists a successful assistant response and emits a final summary", async () => {
    const store = new MemoryStore()
    const provider: ModelProvider = {
      stream: async function* () {
        yield { type: "text_delta", text: "已完成检查。" }
        yield { type: "done", finishReason: "stop" }
      },
    }
    const session = new AgentSession({
      sessionId: "00000000-0000-4000-8000-000000000001",
      cwd: "/workspace",
      prompt: "检查项目",
      provider,
      tools: {
        definitions: () => [{ name: "write_file", description: "写文件", parameters: {}, requiresApproval: true, risk: "medium" }],
        execute: async () => ({ output: "不应执行" }),
      },
      approvals: { resolve: async () => "deny" },
      store,
    })

    const events = []
    for await (const event of session.run()) events.push(event)

    expect(events).toContainEqual(expect.objectContaining({ type: "assistant", content: "已完成检查。" }))
    expect(events.at(-1)).toMatchObject({ type: "result", success: true, summary: { toolCalls: 0 } })
    expect(store.sessions.get("00000000-0000-4000-8000-000000000001")).toMatchObject({ success: true })
  })

  it("maps a denied approval to APPROVAL_DENIED", async () => {
    const store = new MemoryStore()
    const provider: ModelProvider = {
      stream: async function* () {
        yield { type: "tool_call", toolCall: { id: "call-1", name: "write_file", input: { path: "a.txt", content: "x" } } }
        yield { type: "done", finishReason: "tool_calls" }
      },
    }
    const tools: ToolRegistry = {
      definitions: () => [{ name: "write_file", description: "写文件", parameters: {}, requiresApproval: true, risk: "medium" }],
      execute: async () => ({ output: "不应执行" }),
    }
    const session = new AgentSession({
      sessionId: "00000000-0000-4000-8000-000000000002",
      cwd: "/workspace",
      prompt: "写文件",
      provider,
      tools,
      approvals: { resolve: async () => "deny" },
      store,
    })

    const events = []
    for await (const event of session.run()) events.push(event)

    expect(events.at(-1)).toMatchObject({ type: "result", success: false, code: "APPROVAL_DENIED" })
    expect(events).not.toContainEqual(expect.objectContaining({ subtype: "running" }))
  })

  it("converts an external abort into a terminal CANCELLED result", async () => {
    const store = new MemoryStore()
    const controller = new AbortController()
    const provider: ModelProvider = {
      stream: async function* ({ signal }) {
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => resolve(), { once: true })
        })
        yield { type: "done", finishReason: "stop" }
      },
    }
    const session = new AgentSession({
      sessionId: "00000000-0000-4000-8000-000000000003",
      cwd: "/workspace",
      prompt: "等待取消",
      provider,
      tools: {
        definitions: () => [{ name: "write_file", description: "写文件", parameters: {}, requiresApproval: true, risk: "medium" }],
        execute: async () => ({ output: "不应执行" }),
      },
      approvals: { resolve: async () => "deny" },
      store,
      signal: controller.signal,
    })

    const events: Awaited<ReturnType<typeof collectEvents>> = []
    const running = collectEvents(session)
    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.abort()
    events.push(...await running)

    expect(events.at(-1)).toMatchObject({ type: "result", success: false, code: "CANCELLED" })
    expect(store.sessions.get("00000000-0000-4000-8000-000000000003")).toMatchObject({ success: false, code: "CANCELLED" })
  })

  it("projects mode instructions and todos into the system prompt, then emits context compaction", async () => {
    const store = new MemoryStore()
    const requests: string[] = []
    const provider: ModelProvider = {
      stream: async function* (request) {
        requests.push(request.messages[0]?.content ?? "")
        yield { type: "text_delta", text: "完成。" }
        yield { type: "done", finishReason: "stop" }
      },
    }
    const history = Array.from({ length: 5 }, (_, index) => ({ role: "user" as const, content: `历史 ${index}` }))
    const session = new AgentSession({
      sessionId: "00000000-0000-4000-8000-000000000004",
      cwd: "/workspace",
      prompt: "不应重新注入",
      provider,
      tools: toolRegistry(),
      approvals: { resolve: async () => "deny" },
      store,
      initialMessages: [{ role: "system", content: "保留的系统提示" }, ...history],
      mode: { slug: "code", name: "Code", roleDefinition: "你是代码专家。" },
      todos: [{ id: "todo-1", content: "完成迁移", status: "in_progress" }],
      maxContextMessages: 3,
    })

    const events = await collectEvents(session)

    // 恢复会话优先使用原系统消息；新会话的模式与待办提示词由独立测试覆盖。
    expect(requests[0]).toBe("保留的系统提示")
    expect(events).toContainEqual(expect.objectContaining({ type: "system", subtype: "context_compacted" }))
  })

  it("builds a mode-aware system prompt for a new session", async () => {
    let systemPrompt = ""
    const provider: ModelProvider = {
      stream: async function* (request) {
        systemPrompt = request.messages[0]?.content ?? ""
        yield { type: "text_delta", text: "完成。" }
        yield { type: "done", finishReason: "stop" }
      },
    }
    const session = new AgentSession({
      sessionId: "00000000-0000-4000-8000-000000000005",
      cwd: "/workspace",
      prompt: "检查",
      provider,
      tools: toolRegistry(),
      approvals: { resolve: async () => "deny" },
      store: new MemoryStore(),
      mode: { slug: "review", name: "Review", roleDefinition: "你是审查专家。", customInstructions: "先读测试。", allowedTools: ["read_file"] },
      todos: [{ id: "todo-2", content: "检查变更", status: "pending" }],
    })

    await collectEvents(session)

    expect(systemPrompt).toContain("你是审查专家。")
    expect(systemPrompt).toContain("先读测试。")
    expect(systemPrompt).toContain("允许使用的工具：read_file")
    expect(systemPrompt).toContain("[pending] 检查变更")
  })

  it("enforces the mode tool allowlist instead of treating it as prompt-only guidance", async () => {
    const session = new AgentSession({
      sessionId: "00000000-0000-4000-8000-000000000006",
      cwd: "/workspace",
      prompt: "修改文件",
      mode: { slug: "read-only", name: "只读", roleDefinition: "只读模式", allowedTools: ["read_file"] },
      provider: {
        async *stream() {
          yield { type: "tool_call", toolCall: { id: "write", name: "write_file", input: { path: "a.txt", content: "x" } } }
          yield { type: "done", finishReason: "tool_calls" }
        },
      },
      tools: {
        definitions: () => [{ name: "write_file", description: "写文件", parameters: {}, requiresApproval: true, risk: "medium" }],
        execute: async () => ({ output: "不应执行" }),
      },
      approvals: { resolve: async () => "approve" },
      store: new MemoryStore(),
    })

    const events = await collectEvents(session)
    expect(events.at(-1)).toMatchObject({ type: "result", success: false, code: "APPROVAL_DENIED" })
  })

  it("updates and persists todos through the runtime-owned update_todo tool", async () => {
    const store = new MemoryStore()
    let requestCount = 0
    const session = new AgentSession({
      sessionId: "00000000-0000-4000-8000-000000000007",
      cwd: "/workspace",
      prompt: "维护待办",
      provider: {
        async *stream() {
          if (requestCount++ === 0) {
            yield { type: "tool_call", toolCall: { id: "todo-1", name: "update_todo", input: { id: "review", content: "检查变更", status: "completed" } } }
            yield { type: "done", finishReason: "tool_calls" }
            return
          }
          yield { type: "text_delta", text: "待办已完成。" }
          yield { type: "done", finishReason: "stop" }
        },
      },
      tools: toolRegistry(),
      approvals: { resolve: async () => "deny" },
      store,
    })

    const events = await collectEvents(session)
    expect(events).toContainEqual(expect.objectContaining({ type: "tool_result", tool_result: expect.objectContaining({ output: "待办已更新：completed 检查变更" }) }))
    expect(store.sessions.get("00000000-0000-4000-8000-000000000007")?.todos).toEqual([
      { id: "review", content: "检查变更", status: "completed" },
    ])
  })
})

async function collectEvents(session: AgentSession) {
  const events = []
  for await (const event of session.run()) events.push(event)
  return events
}
