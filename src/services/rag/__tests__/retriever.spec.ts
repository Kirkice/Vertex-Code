import { describe, expect, it, vi } from "vitest"

import { VectorRetriever } from "../retriever"
import { RagService, buildRagContextBlock } from "../ragService"
import { vectorResultToNode } from "../types"
import type { VectorStoreSearchResult } from "../../code-index/interfaces"
import type { IEmbedder, IVectorStore, PointStruct } from "../../code-index/interfaces"

function createMockEmbedder(vectors: Record<string, number[]>): IEmbedder {
	return {
		embedderInfo: { name: "openai" },
		async createEmbeddings(texts: string[]) {
			return { embeddings: texts.map((t) => vectors[t] ?? [0, 0, 0, 0]) }
		},
		async validateConfiguration() {
			return { valid: true }
		},
	}
}

function createMockVectorStore(results: VectorStoreSearchResult[]): IVectorStore & {
	upserted: PointStruct[]
	deleted: string[]
	cleared: boolean
} {
	return {
		upserted: [],
		deleted: [],
		cleared: false,
		async initialize() {
			return true
		},
		async upsertPoints(points: PointStruct[]) {
			this.upserted.push(...points)
		},
		async search() {
			return results
		},
		async deletePointsByFilePath(filePath: string) {
			this.deleted.push(filePath)
		},
		async deletePointsByMultipleFilePaths(filePaths: string[]) {
			this.deleted.push(...filePaths)
		},
		async clearCollection() {
			this.cleared = true
		},
		async deleteCollection() {},
		async collectionExists() {
			return true
		},
		async hasIndexedData() {
			return true
		},
		async markIndexingComplete() {},
		async markIndexingIncomplete() {},
	}
}

function makeResult(id: string, score: number, payload: Record<string, unknown>): VectorStoreSearchResult {
	return { id, score, payload: payload as VectorStoreSearchResult["payload"] }
}

describe("VectorRetriever", () => {
	it("embeds the query and returns resolved nodes with scores", async () => {
		const embedder = createMockEmbedder({ hello: [1, 2, 3, 4] })
		const results = [
			makeResult("n1", 0.9, {
				nodeId: "n1",
				filePath: "guide.md",
				codeChunk: "hello world",
				startLine: 1,
				endLine: 1,
				sourceType: "markdown",
			}),
		]
		const vectorStore = createMockVectorStore(results)
		const retriever = new VectorRetriever(embedder, vectorStore, vectorResultToNode)

		const nodes = await retriever.retrieve("hello")

		expect(nodes).toHaveLength(1)
		expect(nodes[0]).toMatchObject({
			score: 0.9,
			retriever: "vector",
		})
		expect(nodes[0].node).toMatchObject({
			id: "n1",
			sourcePath: "guide.md",
			text: "hello world",
			startLine: 1,
			endLine: 1,
		})
	})

	it("returns an empty array when the query embedding is missing", async () => {
		const embedder: IEmbedder = {
			embedderInfo: { name: "openai" },
			async createEmbeddings() {
				return { embeddings: [] }
			},
			async validateConfiguration() {
				return { valid: true }
			},
		}
		const vectorStore = createMockVectorStore([makeResult("n1", 0.9, { filePath: "x.md", codeChunk: "x" })])
		const retriever = new VectorRetriever(embedder, vectorStore, vectorResultToNode)

		const nodes = await retriever.retrieve("missing")

		expect(nodes).toEqual([])
	})

	it("filters by sourceTypes", async () => {
		const embedder = createMockEmbedder({ q: [1, 2, 3, 4] })
		const results = [
			makeResult("n1", 0.9, { nodeId: "n1", filePath: "a.md", codeChunk: "a", sourceType: "markdown" }),
			makeResult("n2", 0.8, { nodeId: "n2", filePath: "b.md", codeChunk: "b", sourceType: "knowledge" }),
		]
		const vectorStore = createMockVectorStore(results)
		const retriever = new VectorRetriever(embedder, vectorStore, vectorResultToNode)

		const nodes = await retriever.retrieve("q", { sourceTypes: ["knowledge"] })

		expect(nodes).toHaveLength(1)
		expect(nodes[0].node.id).toBe("n2")
	})

	it("deduplicates nodes by id", async () => {
		const embedder = createMockEmbedder({ q: [1, 2, 3, 4] })
		const results = [
			makeResult("n1", 0.9, { nodeId: "n1", filePath: "a.md", codeChunk: "a", sourceType: "markdown" }),
			makeResult("n1-dup", 0.85, { nodeId: "n1", filePath: "a.md", codeChunk: "a", sourceType: "markdown" }),
		]
		const vectorStore = createMockVectorStore(results)
		const retriever = new VectorRetriever(embedder, vectorStore, vectorResultToNode)

		const nodes = await retriever.retrieve("q")

		expect(nodes).toHaveLength(1)
	})

	it("sorts unstable vector-store results by descending score before deduplication", async () => {
		const embedder = createMockEmbedder({ q: [1, 2, 3, 4] })
		const results = [
			makeResult("low", 0.5, { nodeId: "shared", filePath: "a.md", codeChunk: "low", sourceType: "markdown" }),
			makeResult("other", 0.7, { nodeId: "other", filePath: "b.md", codeChunk: "other", sourceType: "markdown" }),
			makeResult("high", 0.9, { nodeId: "shared", filePath: "a.md", codeChunk: "high", sourceType: "markdown" }),
		]
		const retriever = new VectorRetriever(embedder, createMockVectorStore(results), vectorResultToNode)

		const nodes = await retriever.retrieve("q")

		expect(nodes.map(({ node, score }) => [node.id, score])).toEqual([
			["shared", 0.9],
			["other", 0.7],
		])
	})

	it("uses tuned retrieval defaults", async () => {
		const embedder = createMockEmbedder({ q: [1, 2, 3, 4] })
		const vectorStore = createMockVectorStore([])
		const searchSpy = vi.spyOn(vectorStore, "search")
		const retriever = new VectorRetriever(embedder, vectorStore, vectorResultToNode)

		await retriever.retrieve("q")

		expect(searchSpy).toHaveBeenCalledWith([1, 2, 3, 4], undefined, 0.4, 6)
	})

	it("passes topK, minScore, and directoryPrefix to the vector store", async () => {
		const embedder = createMockEmbedder({ q: [1, 2, 3, 4] })
		const vectorStore = createMockVectorStore([])
		const searchSpy = vi.spyOn(vectorStore, "search")
		const retriever = new VectorRetriever(embedder, vectorStore, vectorResultToNode)

		await retriever.retrieve("q", { topK: 3, minScore: 0.5, directoryPrefix: "docs/" })

		expect(searchSpy).toHaveBeenCalledWith([1, 2, 3, 4], "docs/", 0.5, 3)
	})
})

describe("RagService", () => {
	it("returns a bounded context with sources and diagnostics", async () => {
		const embedder = createMockEmbedder({ q: [1, 2, 3, 4] })
		const results = [
			makeResult("n1", 0.9, {
				nodeId: "n1",
				filePath: "guide.md",
				codeChunk: "hello world",
				startLine: 1,
				endLine: 1,
				sourceType: "markdown",
			}),
		]
		const vectorStore = createMockVectorStore(results)
		const service = new RagService(embedder, vectorStore)

		const result = await service.query("q")

		expect(result.retrievalMode).toBe("vector")
		expect(result.nodes).toHaveLength(1)
		expect(result.sources).toHaveLength(1)
		expect(result.sources[0]).toMatchObject({ id: "S1", path: "guide.md", startLine: 1, endLine: 1 })
		expect(result.diagnostics.indexAvailable).toBe(true)
		expect(result.diagnostics.resultCount).toBe(1)
		expect(result.diagnostics.truncated).toBe(false)
		expect(result.context).toContain("hello world")
	})

	it("truncates results when the token budget is exceeded", async () => {
		const embedder = createMockEmbedder({ q: [1, 2, 3, 4] })
		const longText = "x".repeat(200) // ~50 tokens each
		const results = [
			makeResult("n1", 0.9, { nodeId: "n1", filePath: "a.md", codeChunk: longText, sourceType: "markdown" }),
			makeResult("n2", 0.8, { nodeId: "n2", filePath: "b.md", codeChunk: longText, sourceType: "markdown" }),
			makeResult("n3", 0.7, { nodeId: "n3", filePath: "c.md", codeChunk: longText, sourceType: "markdown" }),
		]
		const vectorStore = createMockVectorStore(results)
		const service = new RagService(embedder, vectorStore)

		const result = await service.query("q", { maxTokens: 60 })

		expect(result.diagnostics.truncated).toBe(true)
		expect(result.nodes.length).toBeLessThan(3)
	})

	it("skips an oversized result and packs later results within the token budget", async () => {
		const embedder = createMockEmbedder({ q: [1, 2, 3, 4] })
		const results = [
			makeResult("large", 0.9, {
				nodeId: "large",
				filePath: "large.md",
				codeChunk: "x".repeat(1000),
				sourceType: "markdown",
			}),
			makeResult("small", 0.8, {
				nodeId: "small",
				filePath: "small.md",
				codeChunk: "answer".repeat(20),
				sourceType: "markdown",
			}),
		]
		const service = new RagService(embedder, createMockVectorStore(results))

		const result = await service.query("q", { maxTokens: 40 })

		expect(result.nodes.map(({ node }) => node.id)).toEqual(["small"])
		expect(result.diagnostics.truncated).toBe(true)
	})

	it("querySafely returns undefined when the query fails", async () => {
		const embedder = createMockEmbedder({ q: [1, 2, 3, 4] })
		const vectorStore = createMockVectorStore([])
		// Force search to throw.
		vi.spyOn(vectorStore, "search").mockRejectedValueOnce(new Error("store unavailable"))
		const service = new RagService(embedder, vectorStore)

		const result = await service.querySafely("q")

		expect(result).toBeUndefined()
	})
})

describe("buildRagContextBlock", () => {
	it("builds a rag-context block with sources", async () => {
		const embedder = createMockEmbedder({ q: [1, 2, 3, 4] })
		const results = [
			makeResult("n1", 0.9, {
				nodeId: "n1",
				filePath: "guide.md",
				codeChunk: "hello world",
				startLine: 1,
				endLine: 1,
				sourceType: "markdown",
			}),
		]
		const vectorStore = createMockVectorStore(results)
		const service = new RagService(embedder, vectorStore)

		const { block, result } = await buildRagContextBlock(service, "q")

		expect(block).toContain("<rag-context>")
		expect(block).toContain("</rag-context>")
		expect(block).toContain("[S1] guide.md:1-1")
		expect(result.nodes).toHaveLength(1)
	})

	it("returns an empty block when no results are found", async () => {
		const embedder = createMockEmbedder({ q: [1, 2, 3, 4] })
		const vectorStore = createMockVectorStore([])
		const service = new RagService(embedder, vectorStore)

		const { block } = await buildRagContextBlock(service, "q")

		expect(block).toBe("")
	})
})
