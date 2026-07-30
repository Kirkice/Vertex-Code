import type { IEmbedder, VectorStoreSearchResult } from "../code-index/interfaces"
import { RAG_DEFAULTS } from "./config"
import type { KnowledgeNode, KnowledgeSourceType, RagQueryOptions, RagVectorStore, RetrievedNode } from "./types"

export const DEFAULT_RAG_TOP_K = RAG_DEFAULTS.topK
export const DEFAULT_RAG_MIN_SCORE = RAG_DEFAULTS.minScore

export class VectorRetriever {
	constructor(
		private readonly embedder: IEmbedder,
		private readonly vectorStore: RagVectorStore,
		private readonly nodeResolver: (result: VectorStoreSearchResult) => KnowledgeNode | undefined,
	) {}

	async retrieve(query: string, options: RagQueryOptions = {}): Promise<RetrievedNode[]> {
		const response = await this.embedder.createEmbeddings([query])
		const vector = response.embeddings[0]
		if (!vector) return []

		const results = await this.vectorStore.search(
			vector,
			options.directoryPrefix,
			options.minScore ?? DEFAULT_RAG_MIN_SCORE,
			options.topK ?? DEFAULT_RAG_TOP_K,
		)
		const sourceTypes: Set<KnowledgeSourceType> | undefined = options.sourceTypes
			? new Set(options.sourceTypes)
			: undefined
		const seen = new Set<string>()

		return [...results]
			.sort((left, right) => right.score - left.score)
			.map((result) => ({ result, node: this.nodeResolver(result) }))
			.filter(({ node }) => node !== undefined)
			.filter(({ node }) => {
				const sourceType = node!.metadata.sourceType
				return !sourceTypes || (typeof sourceType === "string" && sourceTypes.has(sourceType as KnowledgeSourceType))
			})
			.filter(({ node }) => {
				if (seen.has(node!.id)) return false
				seen.add(node!.id)
				return true
			})
			.map(({ result, node }) => ({ node: node!, score: result.score, retriever: "vector" }))
	}
}
