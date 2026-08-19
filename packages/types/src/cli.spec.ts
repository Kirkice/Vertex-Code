import { describe, expect, it } from "vitest"

import {
  rooCliApprovalRequestSchema,
  rooCliFinalOutputSchema,
  rooCliProtocol,
  rooCliSchemaVersion,
  rooCliStreamEventSchema,
} from "./cli.js"

describe("Vertex CLI protocol contract", () => {
  it("validates approval requests and protocol metadata", () => {
    const approval = rooCliApprovalRequestSchema.parse({
      id: "approval-1",
      operation: "shell.execute",
      description: "运行项目检查",
      cwd: "/workspace",
      risk: "medium",
    })

    const event = rooCliStreamEventSchema.parse({
      type: "system",
      subtype: "approval_required",
      protocol: rooCliProtocol,
      schemaVersion: rooCliSchemaVersion,
      approval,
    })

    expect(event.approval).toEqual(approval)
  })

  it("validates final output cost, summary, and runtime error code", () => {
    const output = rooCliFinalOutputSchema.parse({
      type: "result",
      success: false,
      code: "APPROVAL_DENIED",
      sessionId: "75d8dcc6-2a5b-4d55-8318-6161f8547830",
      cost: { totalCost: 0.012, inputTokens: 120, outputTokens: 40 },
      summary: { durationMs: 250, toolCalls: 1, cancelled: false },
      events: [],
    })

    expect(output.code).toBe("APPROVAL_DENIED")
    expect(output.summary?.toolCalls).toBe(1)
  })
})
