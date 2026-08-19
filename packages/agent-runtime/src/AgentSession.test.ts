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
  async complete(sessionId: string, patch: Pick<PersistedSession, "finishedAt" | "success" | "code" | "messages" | "cost">): Promise<void> {
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
      tools: toolRegistry(),
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
})
