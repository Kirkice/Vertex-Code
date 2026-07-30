import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"

import { discoverRagDocumentsFromRoots } from "../../rag/documentSources"
import { ingestRagDocuments } from "../manager"
import type { IEmbedder, IVectorStore, PointStruct } from "../interfaces"

function createEmbedder(): IEmbedder {
	return {
		embedderInfo: { name: "openai" },
		async createEmbeddings(texts: string[]) {
			return { embeddings: texts.map((_, index) => [index, index + 1, index + 2]) }
		},
		async validateConfiguration() {
			return { valid: true }
		},
	}
}

function createVectorStore(): IVectorStore & { upserted: PointStruct[]; deleted: string[] } {
	return {
		upserted: [],
		deleted: [],
		async initialize() {
			return true
		},
		async upsertPoints(points) {
			this.upserted.push(...points)
		},
		async search() {
			return []
		},
		async deletePointsByFilePath(filePath) {
			this.deleted.push(filePath)
		},
		async deletePointsByMultipleFilePaths(filePaths) {
			this.deleted.push(...filePaths)
		},
		async clearCollection() {},
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

describe("manager RAG ingestion integration", () => {
	let workspacePath: string
	let externalKnowledgePath: string

	beforeEach(async () => {
		workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "rag-manager-workspace-"))
		externalKnowledgePath = await fs.mkdtemp(path.join(os.tmpdir(), "rag-manager-knowledge-"))
	})

	afterEach(async () => {
		await Promise.all([
			fs.rm(workspacePath, { recursive: true, force: true }),
			fs.rm(externalKnowledgePath, { recursive: true, force: true }),
		])
	})

	it("discovers, groups, embeds, and persists manifests for all source types", async () => {
		await fs.writeFile(path.join(workspacePath, "guide.md"), "# Guide\nWorkspace documentation", "utf8")
		await fs.writeFile(path.join(workspacePath, "notes.txt"), "Workspace notes", "utf8")
		await fs.writeFile(path.join(externalKnowledgePath, "policy.md"), "# Policy\nExternal knowledge", "utf8")

		const documents = await discoverRagDocumentsFromRoots(
			[
				{ path: workspacePath, sourceType: "markdown" },
				{ path: externalKnowledgePath, sourceType: "knowledge" },
			],
			workspacePath,
		)
		const vectorStore = createVectorStore()

		await ingestRagDocuments(
			workspacePath,
			documents,
			createEmbedder(),
			vectorStore,
			new AbortController().signal,
		)

		const markdownManifest = JSON.parse(
			await fs.readFile(path.join(workspacePath, ".roo", "rag", "markdown-manifest.json"), "utf8"),
		)
		const textManifest = JSON.parse(
			await fs.readFile(path.join(workspacePath, ".roo", "rag", "text-manifest.json"), "utf8"),
		)
		const knowledgeManifest = JSON.parse(
			await fs.readFile(path.join(workspacePath, ".roo", "rag", "knowledge-manifest.json"), "utf8"),
		)

		expect(Object.keys(markdownManifest.files)).toEqual(["guide.md"])
		expect(Object.keys(textManifest.files)).toEqual(["notes.txt"])
		expect(Object.keys(knowledgeManifest.files)).toEqual([path.join(externalKnowledgePath, "policy.md")])
		expect(vectorStore.upserted.map((point) => point.payload.filePath)).toEqual(
			expect.arrayContaining(["guide.md", "notes.txt", path.join(externalKnowledgePath, "policy.md")]),
		)
	})

	it("does not start a source group after cancellation", async () => {
		const controller = new AbortController()
		controller.abort()
		const vectorStore = createVectorStore()

		await ingestRagDocuments(
			workspacePath,
			[{ path: "guide.md", sourceType: "markdown" }],
			createEmbedder(),
			vectorStore,
			controller.signal,
		)

		expect(vectorStore.upserted).toEqual([])
		await expect(fs.access(path.join(workspacePath, ".roo", "rag", "markdown-manifest.json"))).rejects.toThrow()
	})
})
