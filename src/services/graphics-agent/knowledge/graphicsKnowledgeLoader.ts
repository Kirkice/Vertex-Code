/**
 * Graphics Knowledge Loader
 *
 * Loads and caches graphics knowledge documents from the knowledge directory.
 * Reads the index.json for metadata and loads .md files on demand.
 *
 * @module graphics-agent/knowledge/graphicsKnowledgeLoader
 */

import * as fs from "fs"
import * as path from "path"
import type { GraphicsKnowledgeEntry } from "./types"

/**
 * Path to the universal knowledge directory.
 * Graphics knowledge entries are filtered from the universal index by domain.
 */
const KNOWLEDGE_DIR = path.join(
	__dirname,
	"..",
	"..",
	"..",
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
let cachedIndex: GraphicsKnowledgeEntry[] | null = null

/**
 * In-memory cache for loaded knowledge document contents.
 * Keyed by knowledge entry ID.
 */
const contentCache = new Map<string, string>()

/**
 * Load the knowledge index from index.json.
 * Returns cached version if available.
 *
 * @returns Array of knowledge entries, or empty array if index cannot be loaded
 */
export function loadKnowledgeIndex(): GraphicsKnowledgeEntry[] {
	if (cachedIndex) {
		return cachedIndex
	}

	try {
		const raw = fs.readFileSync(INDEX_PATH, "utf-8")
		const allEntries = JSON.parse(raw) as GraphicsKnowledgeEntry[]
		// Filter to only graphics-domain entries from the universal knowledge index
		cachedIndex = allEntries.filter((entry) => entry.domain === "graphics")
		return cachedIndex
	} catch {
		// Index file not found or invalid — return empty
		return []
	}
}

/**
 * Load the full content of a knowledge document by its entry.
 * Returns cached version if available.
 *
 * @param entry - The knowledge entry to load
 * @returns The document content, or empty string if file cannot be read
 */
export function loadKnowledgeContent(entry: GraphicsKnowledgeEntry): string {
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
 * Looks for the first section that contains key conclusions or recommendations.
 *
 * @param entry - The knowledge entry
 * @returns A condensed summary string, or the entry's summary field as fallback
 */
export function extractKnowledgeSummary(entry: GraphicsKnowledgeEntry): string {
	const content = loadKnowledgeContent(entry)
	if (!content) {
		return entry.summary
	}

	// Try to extract the "conclusions" or "key takeaways" section
	const conclusionPatterns = [
		/##\s*(?:\d+\.\s*)?(?:结论|总结|可沉淀|经验结论|核心结论|key\s*takeaways|conclusions?)/i,
		/##\s*(?:\d+\.\s*)?(?:推荐|建议|实施|implementation|recommendations?)/i,
	]

	const lines = content.split("\n")
	let summaryLines: string[] = []
	let capturing = false
	let captureDepth = 0

	for (const line of lines) {
		// Check if this line starts a conclusion section
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
			// Stop capturing when we hit a section at the same or higher level
			const headingMatch = line.match(/^(#+)\s/)
			if (headingMatch && headingMatch[1].length <= captureDepth) {
				break
			}
			summaryLines.push(line)
		}
	}

	if (summaryLines.length > 0) {
		// Trim to reasonable length (max ~80 lines)
		const trimmed = summaryLines.slice(0, 80).join("\n").trim()
		if (trimmed.length > 0) {
			return trimmed
		}
	}

	// Fallback: return the entry's summary field with first 30 lines of content
	const fallbackLines = lines.slice(0, 30).join("\n").trim()
	return `${entry.summary}\n\n${fallbackLines}`
}

/**
 * Clear all caches. Useful for testing or when knowledge files are updated.
 */
export function clearKnowledgeCache(): void {
	cachedIndex = null
	contentCache.clear()
}

/**
 * Get all knowledge entries, sorted by priority (descending).
 *
 * @returns Sorted array of knowledge entries
 */
export function getAllKnowledgeEntries(): GraphicsKnowledgeEntry[] {
	return loadKnowledgeIndex().sort((a, b) => b.priority - a.priority)
}

/**
 * Find a knowledge entry by its ID.
 *
 * @param id - The knowledge entry ID
 * @returns The entry, or undefined if not found
 */
export function findKnowledgeById(id: string): GraphicsKnowledgeEntry | undefined {
	return loadKnowledgeIndex().find((entry) => entry.id === id)
}
