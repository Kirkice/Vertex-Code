import type { RagQueryOptions } from "./types"

export const RAG_DEFAULTS = Object.freeze({
	maxCharacters: 4000,
	overlapCharacters: 400,
	topK: 6,
	minScore: 0.4,
	maxContextTokens: 3000,
	maxFileSize: 512 * 1024,
})

export interface RagConfigurationReader {
	get<T>(section: string, defaultValue: T): T
}

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
	return typeof value === "number" && Number.isFinite(value)
		? Math.min(maximum, Math.max(minimum, value))
		: fallback
}

/** Resolve user-facing retrieval settings into safe query options. */
export function getRagQueryOptions(configuration?: RagConfigurationReader): Required<
	Pick<RagQueryOptions, "topK" | "minScore" | "maxTokens">
> {
	return {
		topK: boundedNumber(configuration?.get("rag.topK", RAG_DEFAULTS.topK), RAG_DEFAULTS.topK, 1, 20),
		minScore: boundedNumber(
			configuration?.get("rag.minScore", RAG_DEFAULTS.minScore),
			RAG_DEFAULTS.minScore,
			0,
			1,
		),
		maxTokens: boundedNumber(
			configuration?.get("rag.maxContextTokens", RAG_DEFAULTS.maxContextTokens),
			RAG_DEFAULTS.maxContextTokens,
			256,
			16000,
		),
	}
}
