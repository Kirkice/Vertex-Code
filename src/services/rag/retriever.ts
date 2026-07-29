import type { IEmbedder, VectorStoreSearchResult } from "../code-index/interfaces"
import type { KnowledgeNode, RagQueryOptions, RagVectorStore, RetrievedNode } from "./types"

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
			options.minScore,
			options.topK ?? 8,
		)
		const sourceTypes = options.sourceTypes ? new Set(options.sourceTypes) : undefined
		const seen = new Set<string>()

		return results
			.map((result) => ({ result, node: this.nodeResolver(result) }))
			.filter(({ node }) => node !== undefined)
			.filter(({ node }) => !sourceTypes || sourceTypes.has(node!.metadata.sourceType as any))
			.filter(({ node }) => {
				if (seen.has(node!.id)) return false
				seen.add(node!.id)
				return true
			})
			.map(({ result, node }) => ({ node: node!, score: result.score, retriever: "vector" }))
	}
}
