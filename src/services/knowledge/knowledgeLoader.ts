/**
 * Knowledge Loader
 *
 * Loads and caches knowledge documents from the universal knowledge directory.
 * Supports all modes and domains.
 *
 * @module knowledge/knowledgeLoader
 */

import * as fs from "fs"
import * as path from "path"
import type { KnowledgeEntry } from "./types"

/**
 * Path to the universal knowledge directory.
 * In bundled code, __dirname points to src/dist/, so we use a relative path from there.
 */
export const KNOWLEDGE_DIR = path.join(
	__dirname,
	"core",
	"prompts",
	"sections",
	"knowledge",
)

/**
 * Path to the knowledge index file.
 */
const INDEX_PATH = path.join(KNOWLEDGE_DIR, "index.json")

/**
 * In-memory cache for the knowledge index.
 */
let cachedIndex: KnowledgeEntry[] | null = null

/**
 * In-memory cache for loaded document contents.
 */
const contentCache = new Map<string, string>()

/**
 * Load the knowledge index from index.json.
 */
export function loadKnowledgeIndex(): KnowledgeEntry[] {
	if (cachedIndex) {
		return cachedIndex
	}

	try {
		const raw = fs.readFileSync(INDEX_PATH, "utf-8")
		cachedIndex = JSON.parse(raw) as KnowledgeEntry[]
		return cachedIndex
	} catch {
		return []
	}
}

/**
 * Load the full content of a knowledge document.
 */
export function loadKnowledgeContent(entry: KnowledgeEntry): string {
	const cached = contentCache.get(entry.id)
	if (cached !== undefined) {
		return cached
	}

	try {
		const filePath = path.join(KNOWLEDGE_DIR, entry.path)
		const content = fs.readFileSync(filePath, "utf-8")
		contentCache.set(entry.id, content)
		return content
	} catch {
		return ""
	}
}

/**
 * Extract a summary section from a knowledge document.
 */
export function extractKnowledgeSummary(entry: KnowledgeEntry): string {
	const content = loadKnowledgeContent(entry)
	if (!content) {
		return entry.summary
	}

	const conclusionPatterns = [
		/##\s*(?:\d+\.\s*)?(?:结论|总结|可沉淀|经验结论|核心结论|key\s*takeaways|conclusions?)/i,
		/##\s*(?:\d+\.\s*)?(?:推荐|建议|实施|implementation|recommendations?)/i,
	]

	const lines = content.split("\n")
	let summaryLines: string[] = []
	let capturing = false
	let captureDepth = 0

	for (const line of lines) {
		if (!capturing) {
			for (const pattern of conclusionPatterns) {
				if (pattern.test(line)) {
					capturing = true
					captureDepth = (line.match(/^#+/) || [""])[0].length
					summaryLines.push(line)
					break
				}
			}
		} else {
			const headingMatch = line.match(/^(#+)\s/)
			if (headingMatch && headingMatch[1].length <= captureDepth) {
				break
			}
			summaryLines.push(line)
		}
	}

	if (summaryLines.length > 0) {
		const trimmed = summaryLines.slice(0, 80).join("\n").trim()
		if (trimmed.length > 0) {
			return trimmed
		}
	}

	const fallbackLines = lines.slice(0, 30).join("\n").trim()
	return `${entry.summary}\n\n${fallbackLines}`
}

/**
 * Clear all caches.
 */
export function clearKnowledgeCache(): void {
	cachedIndex = null
	contentCache.clear()
}

/**
 * Get all knowledge entries, sorted by priority.
 */
export function getAllKnowledgeEntries(): KnowledgeEntry[] {
	return loadKnowledgeIndex().sort((a, b) => b.priority - a.priority)
}

/**
 * Find a knowledge entry by ID.
 */
export function findKnowledgeById(id: string): KnowledgeEntry | undefined {
	return loadKnowledgeIndex().find((entry) => entry.id === id)
}

/**
 * Get knowledge entries for a specific mode.
 */
export function getKnowledgeEntriesForMode(mode: string): KnowledgeEntry[] {
	return loadKnowledgeIndex()
		.filter((entry) => entry.modes.includes(mode) || entry.modes.length === 0)
		.sort((a, b) => b.priority - a.priority)
}
