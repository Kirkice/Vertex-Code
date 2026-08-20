import { describe, expect, it } from "vitest"

import { DeferredApprovalResolver } from "./interactive-approval.js"

describe("DeferredApprovalResolver", () => {
  const request = { id: "request-1", operation: "write_file", description: "write", cwd: "/workspace", risk: "medium" as const }

  it("holds execution until the interactive host submits a decision", async () => {
    const resolver = new DeferredApprovalResolver()
    const decision = resolver.resolve(request, new AbortController().signal)
    expect(resolver.decide(request.id, "always_allow")).toBe(true)
    await expect(decision).resolves.toBe("always_allow")
    expect(resolver.decide(request.id, "approve")).toBe(false)
  })

  it("rejects all unresolved approvals during shutdown", async () => {
    const resolver = new DeferredApprovalResolver()
    const decision = resolver.resolve(request, new AbortController().signal)
    resolver.cancelPending()
    await expect(decision).rejects.toThrow("审批已取消")
  })
})
