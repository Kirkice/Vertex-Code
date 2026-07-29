import { createHash } from "crypto"
import type { KnowledgeDocument, KnowledgeNode } from "./types"

export interface NodeParserOptions {
	maxCharacters?: number
	overlapCharacters?: number
}

const DEFAULT_MAX_CHARACTERS = 6000
const DEFAULT_OVERLAP_CHARACTERS = 500

export function hashContent(content: string): string {
	return createHash("sha256").update(content, "utf8").digest("hex")
}

/** Split text into bounded nodes while preserving source line ranges. */
export function parseDocument(
	document: KnowledgeDocument,
	content: string,
	options: NodeParserOptions = {},
): KnowledgeNode[] {
	const maxCharacters = Math.max(500, options.maxCharacters ?? DEFAULT_MAX_CHARACTERS)
	const overlap = Math.min(
		Math.floor(maxCharacters / 2),
		Math.max(0, options.overlapCharacters ?? DEFAULT_OVERLAP_CHARACTERS),
	)
	const lines = content.split(/\r?\n/)
	const nodes: KnowledgeNode[] = []
	let current: string[] = []
	let currentLength = 0
	let startLine = 0

	const flush = (endLine: number) => {
		const text = current.join("\n").trim()
		if (!text) return
		const contentHash = hashContent(text)
		const id = `${document.id}:${startLine + 1}:${endLine + 1}:${contentHash.slice(0, 12)}`
		nodes.push({
			id,
			documentId: document.id,
			text,
			contentHash,
			sourcePath: document.path,
			startLine: startLine + 1,
			endLine: endLine + 1,
			title: document.title,
			metadata: { ...document.metadata, sourceType: document.sourceType },
		})
	}

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]
		const nextLength = currentLength + line.length + (current.length ? 1 : 0)
		const headingBoundary = current.length > 0 && /^#{1,6}\s/.test(line)
		if (nextLength > maxCharacters || headingBoundary) {
			flush(index - 1)
			const tail = overlap > 0 ? current.join("\n").slice(-overlap) : ""
			current = tail ? tail.split("\n") : []
			currentLength = current.join("\n").length
			startLine = Math.max(0, index - current.length)
		}
		if (!current.length) startLine = index
		current.push(line)
		currentLength += line.length + (current.length > 1 ? 1 : 0)
	}
	flush(lines.length - 1)
	return nodes
}
