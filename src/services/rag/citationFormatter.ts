import type { RetrievedNode, RagSource } from "./types"

export function toSources(nodes: RetrievedNode[]): RagSource[] {
	return nodes.map((result, index) => ({
		id: `S${index + 1}`,
		path: result.node.sourcePath,
		startLine: result.node.startLine,
		endLine: result.node.endLine,
		title: result.node.title,
		score: result.score,
	}))
}

export function formatCitations(nodes: RetrievedNode[]): string {
	return nodes
		.map((result, index) => {
			const node = result.node
			const range = node.startLine ? `:${node.startLine}-${node.endLine ?? node.startLine}` : ""
			return `[S${index + 1}] ${node.sourcePath}${range}\n${node.text}`
		})
		.join("\n\n")
}
