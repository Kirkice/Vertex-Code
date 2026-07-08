/**
 * Graphics Knowledge Capture
 *
 * Provides a mechanism to capture analysis conclusions and insights
 * from graphics debugging sessions, writing them as draft knowledge
 * documents for later review and integration into the knowledge base.
 *
 * @module graphics-agent/knowledge/graphicsKnowledgeCapture
 */

import * as fs from "fs"
import * as path from "path"
import type { GraphicsKnowledgeEntry, KnowledgeKind } from "./types"
import { loadKnowledgeIndex } from "./graphicsKnowledgeLoader"

/**
 * Directory for draft knowledge documents pending review.
 */
const DRAFTS_DIR = path.join(
	__dirname,
	"..",
	"..",
	"..",
	"core",
	"prompts",
	"sections",
	"graphics-knowledge",
	"drafts",
)

/**
 * Structure of a knowledge capture request.
 */
export interface KnowledgeCaptureRequest {
	/** Title of the captured knowledge */
	title: string
	/** Kind of knowledge (reference, methodology, case-study) */
	kind: KnowledgeKind
	/** Tags for categorization */
	tags: string[]
	/** Trigger keywords for future routing */
	triggers: string[]
	/** Scenario identifiers */
	scenarios: string[]
	/** The main content/body of the knowledge document */
	content: string
	/** Summary for injection mode */
	summary: string
	/** Related skill IDs */
	relatedSkills?: string[]
	/** Related playbook IDs */
	relatedPlaybooks?: string[]
	/** Source context (e.g., which playbook or analysis produced this) */
	sourceContext?: string
}

/**
 * Result of a knowledge capture operation.
 */
export interface KnowledgeCaptureResult {
	/** Whether the capture was successful */
	success: boolean
	/** Path to the created draft file */
	draftPath?: string
	/** Error message if capture failed */
	error?: string
}

/**
 * Capture analysis conclusions as a draft knowledge document.
 *
 * This function:
 * 1. Creates the drafts directory if it doesn't exist
 * 2. Generates a unique filename based on title and timestamp
 * 3. Writes the content as a markdown file with frontmatter
 * 4. Returns the path to the created draft
 *
 * @param request - The capture request with content and metadata
 * @returns Capture result with path to the draft file
 */
export function captureKnowledge(request: KnowledgeCaptureRequest): KnowledgeCaptureResult {
	try {
		// Ensure drafts directory exists
		if (!fs.existsSync(DRAFTS_DIR)) {
			fs.mkdirSync(DRAFTS_DIR, { recursive: true })
		}

		// Generate filename: kebab-case title + timestamp
		const slug = request.title
			.toLowerCase()
			.replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
			.replace(/^-|-$/g, "")
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
		const filename = `${slug}-${timestamp}.md`
		const filePath = path.join(DRAFTS_DIR, filename)

		// Build frontmatter
		const frontmatter = [
			"---",
			`title: "${request.title}"`,
			`kind: ${request.kind}`,
			`tags: [${request.tags.map((t) => `"${t}"`).join(", ")}]`,
			`triggers: [${request.triggers.map((t) => `"${t}"`).join(", ")}]`,
			`scenarios: [${request.scenarios.map((s) => `"${s}"`).join(", ")}]`,
			`summary: "${request.summary.replace(/"/g, '\\"')}"`,
			`relatedSkills: [${(request.relatedSkills || []).map((s) => `"${s}"`).join(", ")}]`,
			`relatedPlaybooks: [${(request.relatedPlaybooks || []).map((p) => `"${p}"`).join(", ")}]`,
			`status: draft`,
			`capturedAt: "${new Date().toISOString()}"`,
			request.sourceContext ? `sourceContext: "${request.sourceContext}"` : null,
			"---",
		]
			.filter(Boolean)
			.join("\n")

		// Write file
		const fullContent = `${frontmatter}\n\n${request.content}\n`
		fs.writeFileSync(filePath, fullContent, "utf-8")

		return {
			success: true,
			draftPath: filePath,
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

/**
 * List all draft knowledge documents.
 *
 * @returns Array of draft file paths
 */
export function listKnowledgeDrafts(): string[] {
	try {
		if (!fs.existsSync(DRAFTS_DIR)) {
			return []
		}
		return fs
			.readdirSync(DRAFTS_DIR)
			.filter((f) => f.endsWith(".md"))
			.map((f) => path.join(DRAFTS_DIR, f))
	} catch {
		return []
	}
}

/**
 * Promote a draft knowledge document to the main knowledge base.
 *
 * This function:
 * 1. Reads the draft file
 * 2. Moves it to the main knowledge directory
 * 3. Adds an entry to index.json
 *
 * Note: This is a manual operation. In the future, this could be
 * automated with a review workflow.
 *
 * @param draftPath - Path to the draft file
 * @returns Whether the promotion was successful
 */
export function promoteKnowledgeDraft(draftPath: string): boolean {
	try {
		if (!fs.existsSync(draftPath)) {
			return false
		}

		const content = fs.readFileSync(draftPath, "utf-8")
		const filename = path.basename(draftPath)
		const targetPath = path.join(path.dirname(DRAFTS_DIR), filename)

		// Move file to main knowledge directory
		fs.writeFileSync(targetPath, content, "utf-8")
		fs.unlinkSync(draftPath)

		return true
	} catch {
		return false
	}
}

/**
 * Build a structured conclusion block from a graphics analysis result.
 * This is a helper for creating capture-ready content.
 *
 * @param analysis - The analysis result to extract conclusions from
 * @returns Formatted markdown string suitable for knowledge capture
 */
export function buildCaptureContent(analysis: {
	title: string
	findings: string[]
	rootCause?: string
	recommendations: string[]
	relatedKnowledgeIds?: string[]
}): string {
	const parts: string[] = []

	parts.push(`# ${analysis.title}\n`)

	parts.push("## Findings\n")
	for (const finding of analysis.findings) {
		parts.push(`- ${finding}`)
	}
	parts.push("")

	if (analysis.rootCause) {
		parts.push("## Root Cause\n")
		parts.push(analysis.rootCause)
		parts.push("")
	}

	parts.push("## Recommendations\n")
	for (const rec of analysis.recommendations) {
		parts.push(`- ${rec}`)
	}
	parts.push("")

	if (analysis.relatedKnowledgeIds && analysis.relatedKnowledgeIds.length > 0) {
		parts.push("## Related Knowledge\n")
		for (const id of analysis.relatedKnowledgeIds) {
			parts.push(`- \`${id}\``)
		}
		parts.push("")
	}

	return parts.join("\n")
}
