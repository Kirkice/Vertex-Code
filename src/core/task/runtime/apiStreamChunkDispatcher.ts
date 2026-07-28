import type {
	ApiStreamChunk,
	ApiStreamGroundingChunk,
	ApiStreamToolCallChunk,
	ApiStreamToolCallPartialChunk,
	ApiStreamUsageChunk,
} from "../../../api/transform/stream"
import { ApiStreamContentState } from "./apiStreamContentState"

type MaybePromise<T> = T | Promise<T>

export interface ApiStreamChunkDispatcherHandlers {
	state: ApiStreamContentState
	onReasoning: (formattedReasoning: string) => MaybePromise<void>
	onUsage: (chunk: ApiStreamUsageChunk) => void
	onGrounding?: (chunk: ApiStreamGroundingChunk) => void
	onToolCallPartial: (chunk: ApiStreamToolCallPartialChunk) => MaybePromise<void>
	onToolCall: (chunk: ApiStreamToolCallChunk) => MaybePromise<void>
	onText: (assistantMessage: string) => MaybePromise<void>
}

/**
 * Routes one provider stream chunk to the Task-specific side-effect handlers.
 * State accumulation lives here so the stream loop only controls iteration,
 * cancellation, and retry boundaries.
 */
export async function dispatchApiStreamChunk(
	chunk: ApiStreamChunk,
	handlers: ApiStreamChunkDispatcherHandlers,
): Promise<void> {
	switch (chunk.type) {
		case "reasoning":
			await handlers.onReasoning(handlers.state.appendReasoning(chunk.text))
			return
		case "usage":
			handlers.onUsage(chunk)
			return
		case "grounding":
			handlers.state.addGroundingSources(chunk.sources)
			handlers.onGrounding?.(chunk)
			return
		case "tool_call_partial":
			await handlers.onToolCallPartial(chunk)
			return
		case "tool_call":
			await handlers.onToolCall(chunk)
			return
		case "text":
			await handlers.onText(handlers.state.appendText(chunk.text))
			return
		default:
			return
	}
}
