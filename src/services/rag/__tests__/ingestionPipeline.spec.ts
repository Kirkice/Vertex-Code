import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { IngestionPipeline } from "../ingestionPipeline"
import type { IEmbedder, IVectorStore, PointStruct } from "../../code-index/interfaces"

function createMockEmbedder(): IEmbedder & { calls: string[][] } {
	const calls: string[][] = []
	return {
		calls,
		embedderInfo: { name: "openai" },
		async createEmbeddings(texts: string[]) {
			calls.push(texts)
			return { embeddings: texts.map((_, i) => [i, i + 1, i + 2, i + 3]) }
		},
		async validateConfiguration() {
			return { valid: true }
		},
	}
}

function createMockVectorStore(): IVectorStore & {
	upserted: PointStruct[]
	deletedByFilePath: string[]
	cleared: boolean
} {
	return {
		upserted: [],
		deletedByFilePath: [],
		cleared: false,
		async initialize() {
			return true
		},
		async upsertPoints(points: PointStruct[]) {
			this.upserted.push(...points)
		},
		async search() {
			return []
		},
		async deletePointsByFilePath(filePath: string) {
			this.deletedByFilePath.push(filePath)
		},
		async deletePointsByMultipleFilePaths(filePaths: string[]) {
			this.deletedByFilePath.push(...filePaths)
		},
		async clearCollection() {
			this.cleared = true
		},
		async deleteCollection() {},
		async collectionExists() {
			return true
		},
		async hasIndexedData() {
			return false
		},
		async markIndexingComplete() {},
		async markIndexingIncomplete() {},
	}
}

describe("RAG ingestion pipeline", () => {
	let workspaceDir: string
	let manifestPath: string
	const createdDirs: string[] = []

	beforeEach(async () => {
		workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "rag-ingest-"))
		createdDirs.push(workspaceDir)
		manifestPath = path.join(workspaceDir, ".roo", "rag", "markdown-manifest.json")
	})

	afterEach(async () => {
		await Promise.all(
			createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }).catch(() => {})),
		)
	})

	async function writeFile(rel: string, content: string): Promise<void> {
		const filePath = path.join(workspaceDir, rel)
		await fs.mkdir(path.dirname(filePath), { recursive: true })
		await fs.writeFile(filePath, content, "utf8")
	}

	it("embeds and upserts new files", async () => {
		await writeFile("guide.md", "# Guide\ncontent")
		const embedder = createMockEmbedder()
		const vectorStore = createMockVectorStore()
		const pipeline = new IngestionPipeline(embedder, vectorStore)

		const result = await pipeline.ingest({
			sourceType: "markdown",
			rootPath: workspaceDir,
			files: ["guide.md"],
			manifestPath,
		})

		expect(result.processedFiles).toBe(1)
		expect(result.skippedFiles).toBe(0)
		expect(result.nodeCount).toBeGreaterThan(0)
		expect(embedder.calls).toHaveLength(1)
		expect(vectorStore.upserted.length).toBeGreaterThan(0)
		expect(vectorStore.upserted[0].payload).toMatchObject({ filePath: "guide.md", sourceType: "markdown" })
	})

	it("skips unchanged files on subsequent runs", async () => {
		await writeFile("stable.md", "# Stable\ncontent")
		const embedder = createMockEmbedder()
		const vectorStore = createMockVectorStore()
		const pipeline = new IngestionPipeline(embedder, vectorStore)

		await pipeline.ingest({
			sourceType: "markdown",
			rootPath: workspaceDir,
			files: ["stable.md"],
			manifestPath,
		})
		// Second run with the same content.
		const result = await pipeline.ingest({
			sourceType: "markdown",
			rootPath: workspaceDir,
			files: ["stable.md"],
			manifestPath,
		})

		expect(result.processedFiles).toBe(0)
		expect(result.skippedFiles).toBe(1)
		expect(embedder.calls).toHaveLength(1) // Only the first run embedded.
	})

	it("deletes stale vectors for files removed from scope", async () => {
		await writeFile("keep.md", "# Keep")
		await writeFile("gone.md", "# Gone")
		const embedder = createMockEmbedder()
		const vectorStore = createMockVectorStore()
		const pipeline = new IngestionPipeline(embedder, vectorStore)

		await pipeline.ingest({
			sourceType: "markdown",
			rootPath: workspaceDir,
			files: ["keep.md", "gone.md"],
			manifestPath,
		})
		// Second run without "gone.md".
		await pipeline.ingest({
			sourceType: "markdown",
			rootPath: workspaceDir,
			files: ["keep.md"],
			manifestPath,
		})

		expect(vectorStore.deletedByFilePath).toContain("gone.md")
	})

	it("re-embeds changed files and deletes old vectors first", async () => {
		await writeFile("change.md", "# Original")
		const embedder = createMockEmbedder()
		const vectorStore = createMockVectorStore()
		const pipeline = new IngestionPipeline(embedder, vectorStore)

		await pipeline.ingest({
			sourceType: "markdown",
			rootPath: workspaceDir,
			files: ["change.md"],
			manifestPath,
		})
		// Modify the file.
		await writeFile("change.md", "# Updated\ncontent")
		await pipeline.ingest({
			sourceType: "markdown",
			rootPath: workspaceDir,
			files: ["change.md"],
			manifestPath,
		})

		expect(vectorStore.deletedByFilePath).toContain("change.md")
		expect(embedder.calls).toHaveLength(2)
	})

	it("throws when the abort signal is already aborted", async () => {
		await writeFile("abort.md", "# Abort")
		const embedder = createMockEmbedder()
		const vectorStore = createMockVectorStore()
		const pipeline = new IngestionPipeline(embedder, vectorStore)
		const controller = new AbortController()
		controller.abort()

		await expect(
			pipeline.ingest({
				sourceType: "markdown",
				rootPath: workspaceDir,
				files: ["abort.md"],
				manifestPath,
				signal: controller.signal,
			}),
		).rejects.toThrow("RAG ingestion cancelled")
	})

	it("skips files exceeding the max file size", async () => {
		await writeFile("big.md", "x".repeat(1024))
		const embedder = createMockEmbedder()
		const vectorStore = createMockVectorStore()
		const pipeline = new IngestionPipeline(embedder, vectorStore)

		const result = await pipeline.ingest({
			sourceType: "markdown",
			rootPath: workspaceDir,
			files: ["big.md"],
			manifestPath,
			maxFileSize: 512,
		})

		expect(result.processedFiles).toBe(0)
		expect(result.skippedFiles).toBe(1)
		expect(embedder.calls).toHaveLength(0)
	})

	it("handles absolute file paths from external knowledge roots", async () => {
		const externalDir = await fs.mkdtemp(path.join(os.tmpdir(), "rag-ext-"))
		createdDirs.push(externalDir)
		const externalFile = path.join(externalDir, "knowledge.md")
		await fs.writeFile(externalFile, "# External knowledge", "utf8")

		const embedder = createMockEmbedder()
		const vectorStore = createMockVectorStore()
		const pipeline = new IngestionPipeline(embedder, vectorStore)

		const result = await pipeline.ingest({
			sourceType: "knowledge",
			rootPath: workspaceDir,
			files: [externalFile],
			manifestPath: path.join(workspaceDir, ".roo", "rag", "knowledge-manifest.json"),
		})

		expect(result.processedFiles).toBe(1)
		expect(vectorStore.upserted.length).toBeGreaterThan(0)
		// External knowledge files retain their absolute path as the manifest key.
		expect(vectorStore.upserted[0].payload).toMatchObject({ filePath: externalFile })
	})
})
