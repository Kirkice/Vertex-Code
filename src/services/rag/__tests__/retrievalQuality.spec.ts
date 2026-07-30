import { describe, expect, it } from "vitest"

import type { IEmbedder, IVectorStore, Payload, PointStruct, VectorStoreSearchResult } from "../../code-index/interfaces"
import { VectorRetriever } from "../retriever"
import { vectorResultToNode } from "../types"

const vocabulary = [
	"manifest",
	"hash",
	"incremental",
	"citation",
	"source",
	"line",
	"cancel",
	"abort",
	"debounce",
	"qdrant",
	"vector",
	"payload",
] as const

function embed(text: string): number[] {
	const normalized = text.toLowerCase()
	const vector = vocabulary.map((term) => normalized.split(/\W+/).filter((token) => token === term).length)
	const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
	return magnitude ? vector.map((value) => value / magnitude) : vector
}

function cosine(left: number[], right: number[]): number {
	return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0)
}

function createQualityEmbedder(): IEmbedder {
	return {
		embedderInfo: { name: "openai" },
		async createEmbeddings(texts: string[]) {
			return { embeddings: texts.map(embed) }
		},
		async validateConfiguration() {
			return { valid: true }
		},
	}
}

class InMemoryQualityStore implements IVectorStore {
	constructor(private readonly points: PointStruct[]) {}

	async initialize() {
		return true
	}

	async upsertPoints(points: PointStruct[]) {
		this.points.push(...points)
	}

	async search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore = 0,
		maxResults = 50,
	): Promise<VectorStoreSearchResult[]> {
		return this.points
			.filter((point) => !directoryPrefix || String(point.payload.filePath).startsWith(directoryPrefix))
			.map((point) => ({
				id: point.id,
				score: cosine(queryVector, point.vector),
				payload: point.payload as Payload,
			}))
			.filter((result) => result.score >= minScore)
			.sort((left, right) => right.score - left.score)
			.slice(0, maxResults)
	}

	async deletePointsByFilePath() {}
	async deletePointsByMultipleFilePaths() {}
	async clearCollection() {
		this.points.length = 0
	}
	async deleteCollection() {}
	async collectionExists() {
		return true
	}
	async hasIndexedData() {
		return this.points.length > 0
	}
	async markIndexingComplete() {}
	async markIndexingIncomplete() {}
}

const corpus = [
	{
		id: "manifest",
		path: "docs/incremental-indexing.md",
		text: "The manifest stores a content hash so incremental ingestion skips unchanged documents.",
		sourceType: "markdown",
	},
	{
		id: "citation",
		path: "docs/citations.md",
		text: "Every citation preserves its source path and exact line range for traceable evidence.",
		sourceType: "markdown",
	},
	{
		id: "cancellation",
		path: "knowledge/background-jobs.md",
		text: "Cancellation propagates an abort signal while debounce coalesces repeated refresh events.",
		sourceType: "knowledge",
	},
	{
		id: "qdrant",
		path: "knowledge/qdrant.md",
		text: "Qdrant vector search must return node identity and source type in each payload.",
		sourceType: "knowledge",
	},
]

const qualityCases = [
	{ query: "How does the manifest hash support incremental updates?", expected: "docs/incremental-indexing.md" },
	{ query: "Where do citations keep source line information?", expected: "docs/citations.md" },
	{ query: "How are cancel abort and debounce handled?", expected: "knowledge/background-jobs.md" },
	{ query: "Which Qdrant payload fields are needed for vector results?", expected: "knowledge/qdrant.md" },
]

function createRetriever(): VectorRetriever {
	const points = corpus.map((document) => ({
		id: document.id,
		vector: embed(document.text),
		payload: {
			nodeId: document.id,
			filePath: document.path,
			codeChunk: document.text,
			startLine: 1,
			endLine: 1,
			sourceType: document.sourceType,
		},
	}))
	return new VectorRetriever(createQualityEmbedder(), new InMemoryQualityStore(points), vectorResultToNode)
}

describe("retrieval quality fixture", () => {
	it("meets deterministic Hit@1 and MRR quality gates with tuned defaults", async () => {
		const retriever = createRetriever()
		let hitAtOne = 0
		let reciprocalRank = 0

		for (const qualityCase of qualityCases) {
			const results = await retriever.retrieve(qualityCase.query)
			const rank = results.findIndex(({ node }) => node.sourcePath === qualityCase.expected) + 1
			if (rank === 1) hitAtOne++
			if (rank > 0) reciprocalRank += 1 / rank
		}

		expect(hitAtOne / qualityCases.length).toBe(1)
		expect(reciprocalRank / qualityCases.length).toBe(1)
	})

	it("uses the score threshold to reject an unrelated zero-similarity query", async () => {
		const results = await createRetriever().retrieve("How should the extension render a button theme?")

		expect(results).toEqual([])
	})
})
