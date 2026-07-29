import { describe, expect, it } from "vitest"
import { formatCitations, toSources } from "../citationFormatter"

describe("RAG citations", () => {
	it("keeps source identity and line ranges", () => {
		const nodes = [
			{
				node: {
					id: "node-1",
					documentId: "doc-1",
					text: "relevant text",
					contentHash: "hash",
					sourcePath: "src/example.ts",
					startLine: 10,
					endLine: 14,
					metadata: {},
				},
				score: 0.9,
				retriever: "vector",
			},
		]

		expect(toSources(nodes)[0]).toMatchObject({ id: "S1", path: "src/example.ts", startLine: 10, endLine: 14 })
		expect(formatCitations(nodes)).toContain("[S1] src/example.ts:10-14")
	})
})
