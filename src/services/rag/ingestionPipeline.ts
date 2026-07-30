import * as fs from "fs/promises"
import * as path from "path"
import { hashContent, parseDocument } from "./nodeParser"
import type { IEmbedder, IVectorStore, PointStruct } from "../code-index/interfaces"
import type { KnowledgeDocument, KnowledgeNode, KnowledgeSourceType } from "./types"
import { loadManifest, saveManifest, type RagManifest } from "./manifest"

export interface IngestionOptions {
	sourceType: KnowledgeSourceType
	rootPath: string
	files: string[]
	manifestPath: string
	embeddingModel?: string
	signal?: AbortSignal
	maxFileSize?: number
}

export interface IngestionResult {
	processedFiles: number
	skippedFiles: number
	nodeCount: number
}

export class IngestionPipeline {
	constructor(
		private readonly embedder: IEmbedder,
		private readonly vectorStore: IVectorStore,
	) {}

	async ingest(options: IngestionOptions): Promise<IngestionResult> {
		const manifest = await loadManifest(options.manifestPath)
		const points: PointStruct[] = []
		const nodesByFile = new Map<string, KnowledgeNode[]>()
		let processedFiles = 0
		let skippedFiles = 0

		for (const filePath of options.files) {
			if (options.signal?.aborted) throw new Error("RAG ingestion cancelled")
			const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(options.rootPath, filePath)
			if (options.maxFileSize !== undefined) {
				const stat = await fs.stat(absolutePath)
				if (stat.size > options.maxFileSize) {
					skippedFiles++
					continue
				}
			}
			const content = await fs.readFile(absolutePath, "utf8")
			const fileHash = hashContent(content)
			const relativePath = path.isAbsolute(filePath)
				? absolutePath
				: path.relative(options.rootPath, absolutePath)
			const previous = manifest.files[relativePath]
			if (previous?.hash === fileHash) {
				skippedFiles++
				continue
			}

			if (previous) await this.vectorStore.deletePointsByFilePath(relativePath)
			const document: KnowledgeDocument = {
				id: `${options.sourceType}:${relativePath}`,
				path: relativePath,
				sourceType: options.sourceType,
				contentHash: fileHash,
				metadata: { sourceType: options.sourceType },
			}
			const nodes = parseDocument(document, content)
			const embeddings = nodes.length
				? (
						await this.embedder.createEmbeddings(
							nodes.map((node) => node.text),
							options.embeddingModel,
						)
					).embeddings
				: []
			const nodeIds: string[] = []
			for (let index = 0; index < nodes.length; index++) {
				const node = { ...nodes[index], embedding: embeddings[index] }
				nodesByFile.set(relativePath, [...(nodesByFile.get(relativePath) ?? []), node])
				if (node.embedding) {
					points.push({
						id: node.id,
						vector: node.embedding,
						payload: {
							filePath: relativePath,
							codeChunk: node.text,
							startLine: node.startLine,
							endLine: node.endLine,
							nodeId: node.id,
							sourceType: options.sourceType,
							contentHash: node.contentHash,
						},
					})
				}
				nodeIds.push(node.id)
			}
			manifest.files[relativePath] = { hash: fileHash, nodeIds }
			processedFiles++
		}

		// Remove manifest entries for files that no longer exist or are no longer in scope.
		const activeFiles = new Set(
			options.files.map((filePath) => {
				const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(options.rootPath, filePath)
				return path.isAbsolute(filePath) ? absolutePath : path.relative(options.rootPath, absolutePath)
			}),
		)
		for (const stalePath of Object.keys(manifest.files)) {
			if (!activeFiles.has(stalePath)) {
				await this.vectorStore.deletePointsByFilePath(stalePath)
				delete manifest.files[stalePath]
			}
		}

		if (points.length) await this.vectorStore.upsertPoints(points)
		await saveManifest(options.manifestPath, { ...manifest, embeddingModel: options.embeddingModel })
		return {
			processedFiles,
			skippedFiles,
			nodeCount: [...nodesByFile.values()].reduce((sum, nodes) => sum + nodes.length, 0),
		}
	}
}
