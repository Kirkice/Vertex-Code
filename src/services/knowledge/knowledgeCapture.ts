/**
 * Knowledge Capture
 *
 * Captures analysis conclusions and insights as draft knowledge documents.
 * Works across all modes and domains.
 *
 * @module knowledge/knowledgeCapture
 */

import * as fs from "fs"
import * as path from "path"
import type { KnowledgeKind, KnowledgeDomain } from "./types"

/**
 * Directory for draft knowledge documents.
 */
const DRAFTS_DIR = path.join(
	__dirname,
	"..",
	"..",
	"core",
	"prompts",
	"sections",
	"knowledge",
	"drafts",
)

/**
 * Capture request.
 */
export interface KnowledgeCaptureRequest {
	title: string
	kind: KnowledgeKind
	domain: KnowledgeDomain
	tags: string[]
	triggers: string[]
	scenarios: string[]
	modes: string[]
	content: string
	summary: string
	relatedSkills?: string[]
	relatedPlaybooks?: string[]
	sourceContext?: string
}

/**
 * Capture result.
 */
export interface KnowledgeCaptureResult {
	success: boolean
	draftPath?: string
	error?: string
}

/**
 * Capture analysis conclusions as a draft knowledge document.
 */
export function captureKnowledge(request: KnowledgeCaptureRequest): KnowledgeCaptureResult {
	try {
		if (!fs.existsSync(DRAFTS_DIR)) {
			fs.mkdirSync(DRAFTS_DIR, { recursive: true })
		}

		const slug = request.title
			.toLowerCase()
			.replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
			.replace(/^-|-$/g, "")
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
		const filename = `${slug}-${timestamp}.md`
		const filePath = path.join(DRAFTS_DIR, filename)

		const frontmatter = [
			"---",
			`title: "${request.title}"`,
			`kind: ${request.kind}`,
			`domain: ${request.domain}`,
			`tags: [${request.tags.map((t) => `"${t}"`).join(", ")}]`,
			`triggers: [${request.triggers.map((t) => `"${t}"`).join(", ")}]`,
			`scenarios: [${request.scenarios.map((s) => `"${s}"`).join(", ")}]`,
			`modes: [${request.modes.map((m) => `"${m}"`).join(", ")}]`,
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

		const fullContent = `${frontmatter}\n\n${request.content}\n`
		fs.writeFileSync(filePath, fullContent, "utf-8")

		return { success: true, draftPath: filePath }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

/**
 * List all draft knowledge documents.
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
 * Build structured conclusion content.
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
	}

	return parts.join("\n")
}
