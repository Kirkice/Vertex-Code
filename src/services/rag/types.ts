import type { VectorStoreSearchResult } from "../code-index/interfaces"

export type KnowledgeSourceType = "code" | "markdown" | "text" | "knowledge"

export interface KnowledgeDocument {
	id: string
	path: string
	sourceType: KnowledgeSourceType
	title?: string
	contentHash: string
	metadata: Record<string, string | number | boolean>
}

export interface KnowledgeNode {
	id: string
	documentId: string
	text: string
	contentHash: string
	sourcePath: string
	startLine?: number
	endLine?: number
	title?: string
	metadata: Record<string, string | number | boolean>
	embedding?: number[]
}

export interface RetrievedNode {
	node: KnowledgeNode
	score: number
	retriever: string
}

export interface RagQueryOptions {
	topK?: number
	minScore?: number
	sourceTypes?: KnowledgeSourceType[]
	directoryPrefix?: string
	maxTokens?: number
}

export interface RagSource {
	id: string
	path: string
	startLine?: number
	endLine?: number
	title?: string
	score: number
}

export interface RagDiagnostics {
	queryMs: number
	resultCount: number
	truncated: boolean
	indexAvailable: boolean
	message?: string
}

export interface RagQueryResult {
	context: string
	nodes: RetrievedNode[]
	sources: RagSource[]
	retrievalMode: string
	diagnostics: RagDiagnostics
}

export interface RagVectorStore {
	search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
	): Promise<VectorStoreSearchResult[]>
}

export function vectorResultToNode(result: VectorStoreSearchResult): KnowledgeNode {
	const payload: Record<string, unknown> = result.payload ? { ...result.payload } : {}
	const metadata = Object.fromEntries(
		Object.entries(payload).filter((entry): entry is [string, string | number | boolean] =>
			["string", "number", "boolean"].includes(typeof entry[1]),
		),
	)
	return {
		id: String(payload.nodeId ?? result.id),
		documentId: String(payload.documentId ?? payload.filePath ?? result.id),
		text: String(payload.codeChunk ?? payload.text ?? ""),
		contentHash: String(payload.contentHash ?? ""),
		sourcePath: String(payload.filePath ?? ""),
		startLine: typeof payload.startLine === "number" ? payload.startLine : undefined,
		endLine: typeof payload.endLine === "number" ? payload.endLine : undefined,
		metadata,
	}
}
