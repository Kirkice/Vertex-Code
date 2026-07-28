import type { GroundingSource } from "../../../api/transform/stream"

/**
 * Mutable content accumulated while one assistant response is streaming.
 * Keeping this state together prevents the stream loop from owning unrelated
 * formatting and grounding bookkeeping.
 */
export class ApiStreamContentState {
	assistantMessage = ""
	reasoningMessage = ""
	pendingGroundingSources: GroundingSource[] = []

	appendReasoning(text: string): string {
		this.reasoningMessage += text

		if (!this.reasoningMessage.includes("**")) {
			return this.reasoningMessage
		}

		return this.reasoningMessage.replace(/([.!?])\*\*([^*\n]+)\*\*/g, "$1\n\n**$2**")
	}

	appendText(text: string): string {
		this.assistantMessage += text
		return this.assistantMessage
	}

	addGroundingSources(sources: GroundingSource[] | undefined): void {
		if (sources?.length) {
			this.pendingGroundingSources.push(...sources)
		}
	}
}
