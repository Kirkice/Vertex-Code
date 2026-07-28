import { describe, expect, it } from "vitest"

import { getApiStreamRetryAction } from "../apiStreamRetryPolicy"

describe("getApiStreamRetryAction", () => {
	it("prioritizes bounded context-window recovery", () => {
		expect(
			getApiStreamRetryAction({
				contextWindowExceeded: true,
				retryAttempt: 0,
				maxContextWindowRetries: 3,
				autoApprovalEnabled: true,
			}),
		).toBe("context_window")
	})

	it("switches to automatic retry after context-window retries are exhausted", () => {
		expect(
			getApiStreamRetryAction({
				contextWindowExceeded: true,
				retryAttempt: 3,
				maxContextWindowRetries: 3,
				autoApprovalEnabled: true,
			}),
		).toBe("automatic")
	})

	it("requires user confirmation when auto approval is disabled", () => {
		expect(
			getApiStreamRetryAction({
				contextWindowExceeded: false,
				retryAttempt: 0,
				maxContextWindowRetries: 3,
				autoApprovalEnabled: false,
			}),
		).toBe("user_confirmation")
	})
})
