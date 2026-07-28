import { describe, expect, it, vi } from "vitest"

import type { ApiStreamChunk } from "../../../../api/transform/stream"
import { ApiStreamContentState } from "../apiStreamContentState"
import { dispatchApiStreamChunk } from "../apiStreamChunkDispatcher"

describe("dispatchApiStreamChunk", () => {
	it("routes content and usage chunks while updating stream state", async () => {
		const state = new ApiStreamContentState()
		const onReasoning = vi.fn()
		const onUsage = vi.fn()
		const onText = vi.fn()

		const handlers = {
			state,
			onReasoning,
			onUsage,
			onToolCallPartial: vi.fn(),
			onToolCall: vi.fn(),
			onText,
		}

		await dispatchApiStreamChunk({ type: "reasoning", text: "thinking" }, handlers)
		await dispatchApiStreamChunk({ type: "usage", inputTokens: 2, outputTokens: 3 }, handlers)
		await dispatchApiStreamChunk({ type: "text", text: "answer" }, handlers)

		expect(onReasoning).toHaveBeenCalledWith("thinking")
		expect(onUsage).toHaveBeenCalledWith({ type: "usage", inputTokens: 2, outputTokens: 3 })
		expect(onText).toHaveBeenCalledWith("answer")
		expect(state.assistantMessage).toBe("answer")
	})

	it("routes tool chunks without executing them in the dispatcher", async () => {
		const onToolCallPartial = vi.fn()
		const onToolCall = vi.fn()
		const handlers = {
			state: new ApiStreamContentState(),
			onReasoning: vi.fn(),
			onUsage: vi.fn(),
			onToolCallPartial,
			onToolCall,
			onText: vi.fn(),
		}
		const partialChunk: ApiStreamChunk = { type: "tool_call_partial", index: 0, id: "call-1", name: "read_file" }
		const completeChunk: ApiStreamChunk = {
			type: "tool_call",
			id: "call-1",
			name: "read_file",
			arguments: "{}",
		}

		await dispatchApiStreamChunk(partialChunk, handlers)
		await dispatchApiStreamChunk(completeChunk, handlers)

		expect(onToolCallPartial).toHaveBeenCalledWith(partialChunk)
		expect(onToolCall).toHaveBeenCalledWith(completeChunk)
	})
})
