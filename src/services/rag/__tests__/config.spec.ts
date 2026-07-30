import { describe, expect, it } from "vitest"

import { getRagQueryOptions, RAG_DEFAULTS, type RagConfigurationReader } from "../config"

function configuration(values: Record<string, unknown>): RagConfigurationReader {
	return {
		get<T>(section: string, defaultValue: T): T {
			return (values[section] ?? defaultValue) as T
		},
	}
}

describe("RAG configuration", () => {
	it("exposes the tuned defaults as query options", () => {
		expect(getRagQueryOptions()).toEqual({
			topK: RAG_DEFAULTS.topK,
			minScore: RAG_DEFAULTS.minScore,
			maxTokens: RAG_DEFAULTS.maxContextTokens,
		})
	})

	it("reads user-facing retrieval settings", () => {
		expect(
			getRagQueryOptions(
				configuration({
					"rag.topK": 10,
					"rag.minScore": 0.65,
					"rag.maxContextTokens": 5000,
				}),
			),
		).toEqual({ topK: 10, minScore: 0.65, maxTokens: 5000 })
	})

	it("clamps unsafe values and falls back for non-finite values", () => {
		expect(
			getRagQueryOptions(
				configuration({
					"rag.topK": 100,
					"rag.minScore": -2,
					"rag.maxContextTokens": Number.NaN,
				}),
			),
		).toEqual({ topK: 20, minScore: 0, maxTokens: RAG_DEFAULTS.maxContextTokens })
	})
})
