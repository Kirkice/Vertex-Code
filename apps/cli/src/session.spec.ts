import { describe, expect, it, vi } from "vitest"

import type { CliStreamEvent } from "./protocol.js"
import { validateEvent, validateFinalOutput } from "./protocol.js"
import { createFinalOutput, runHeadlessSession } from "./session.js"

describe("headless CLI session", () => {
  it("fails with a configuration error before network access", async () => {
    vi.stubEnv("VERTEX_API_KEY", "")
    vi.stubEnv("VERTEX_BASE_URL", "")
    vi.stubEnv("VERTEX_MODEL", "")
    const iterator = runHeadlessSession({ cwd: "/workspace", prompt: "检查项目", yolo: false })
    await expect(iterator.next()).rejects.toThrow("VERTEX_API_KEY")
    vi.unstubAllEnvs()
  })

  it("runs a deterministic provider through the real runtime boundary", async () => {
    const events: CliStreamEvent[] = []
    const iterator = runHeadlessSession({
      cwd: "/workspace",
      prompt: "检查项目",
      yolo: true,
      provider: {
        async *stream() {
          yield { type: "text_delta", text: "检查完成。" }
          yield { type: "done", finishReason: "stop" }
        },
      },
    })
    for await (const event of iterator) events.push(validateEvent(event))

    expect(events[0]).toMatchObject({ type: "system", subtype: "session_started" })
    expect(events.at(-1)).toMatchObject({ type: "result", success: true, content: "检查完成。" })
  })

  it("keeps final output aggregation schema-compatible", () => {
    const events = [
      validateEvent({ type: "system", subtype: "session_started", sessionId: "00000000-0000-4000-8000-000000000001" }),
      validateEvent({ type: "result", success: false, code: "APPROVAL_DENIED", sessionId: "00000000-0000-4000-8000-000000000001" }),
    ]
    expect(validateFinalOutput(createFinalOutput(events))).toMatchObject({ success: false, code: "APPROVAL_DENIED" })
  })
})
