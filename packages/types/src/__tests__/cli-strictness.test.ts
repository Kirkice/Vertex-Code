import { describe, expect, it } from "vitest"

import { rooCliStreamEventSchema } from "../cli.js"

describe("strict CLI event invariants", () => {
  it("requires a typed tool event payload", () => {
    expect(rooCliStreamEventSchema.safeParse({ type: "tool_use", subtype: "running" }).success).toBe(false)
    expect(rooCliStreamEventSchema.safeParse({ type: "tool_use", subtype: "running", tool_use: { name: "read_file" } }).success).toBe(true)
  })

  it("requires a session id on terminal result events", () => {
    expect(rooCliStreamEventSchema.safeParse({ type: "result", done: true, success: true }).success).toBe(false)
  })
})
