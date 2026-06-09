/**
 * Context Bundle Builder
 *
 * Extracts minimal necessary context from the workspace for orchestrator models.
 * Controls token cost by only including relevant files and symbols.
 *
 * Input sources:
 * - User question
 * - Current active file
 * - Selected text
 * - Recently edited files
 * - Search results
 * - Error messages
 * - Git diff
 * - Project config files
 */

import * as vscode from "vscode"
import * as path from "path"
import type { ContextBundle, ContextFile, ContextFileReason, SymbolRef } from "@roo-code/types"
import { createBundleId } from "@roo-code/types"

/**
 * Options for building a context bundle
 */
export interface ContextBundleOptions {
	/** User's request text */
	userRequest: string
	/** Currently active file path */
	activeFile?: string
	/** Selected text in the editor */
	selectedText?: string
	/** Additional file paths to include */
	additionalFiles?: string[]
	/** Maximum total tokens for the bundle */
	maxTokens?: number
	/** Maximum content length per file (characters) */
	maxFileLength?: number
	/** Workspace root path */
	workspaceRoot?: string
}

/**
 * Default max tokens per bundle
 */
const DEFAULT_MAX_TOKENS = 30_000

/**
 * Default max file content length (characters)
 */
const DEFAULT_MAX_FILE_LENGTH = 15_000

/**
 * Rough token estimation (1 token ≈ 4 chars for English, ~2 chars for CJK)
 */
function estimateTokens(text: string): number {
	// Simple heuristic: count chars and divide by ~3.5 (mixed language average)
	return Math.ceil(text.length / 3.5)
}

/**
 * Build a context bundle from the workspace
 */
export async function buildContextBundle(options: ContextBundleOptions): Promise<ContextBundle> {
	const {
		userRequest,
		activeFile,
		selectedText,
		additionalFiles = [],
		maxTokens = DEFAULT_MAX_TOKENS,
		maxFileLength = DEFAULT_MAX_FILE_LENGTH,
		workspaceRoot,
	} = options

	const files: ContextFile[] = []
	const symbols: SymbolRef[] = []
	const constraints: string[] = []
	let currentTokens = estimateTokens(userRequest)

	// Add selected text as a constraint if present
	if (selectedText) {
		constraints.push(`User has selected the following code:\n\`\`\`\n${selectedText}\n\`\`\``)
		currentTokens += estimateTokens(selectedText)
	}

	// Process active file first (highest priority)
	if (activeFile) {
		const fileContent = await readFileContent(activeFile, maxFileLength)
		if (fileContent) {
			const fileTokens = estimateTokens(fileContent.content)
			if (currentTokens + fileTokens <= maxTokens) {
				files.push(fileContent)
				currentTokens += fileTokens
			}
		}
	}

	// Process additional files
	for (const filePath of additionalFiles) {
		if (filePath === activeFile) continue // Skip if already added
		if (currentTokens >= maxTokens) break

		const fileContent = await readFileContent(filePath, maxFileLength)
		if (fileContent) {
			const fileTokens = estimateTokens(fileContent.content)
			if (currentTokens + fileTokens <= maxTokens) {
				files.push(fileContent)
				currentTokens += fileTokens
			}
		}
	}

	// Build summary
	const summary = buildSummary(userRequest, files, activeFile)

	return {
		bundleId: createBundleId(),
		summary,
		files,
		symbols,
		constraints,
		tokenEstimate: currentTokens,
	}
}

/**
 * Read file content and create a ContextFile
 */
async function readFileContent(filePath: string, maxLength: number): Promise<ContextFile | null> {
	try {
		const uri = vscode.Uri.file(filePath)
		const document = await vscode.workspace.openTextDocument(uri)
		let content = document.getText()
		let truncated = false

		if (content.length > maxLength) {
			content = content.slice(0, maxLength)
			truncated = true
		}

		return {
			path: filePath,
			reason: determineFileReason(filePath),
			content,
			truncated,
		}
	} catch {
		// File might not exist or not be readable
		return null
	}
}

/**
 * Determine the reason a file is included in the context
 */
function determineFileReason(filePath: string): ContextFileReason {
	const basename = path.basename(filePath).toLowerCase()

	// Config files
	if (
		basename.includes("config") ||
		basename.includes(".json") ||
		basename.includes(".yaml") ||
		basename.includes(".yml") ||
		basename.includes("tsconfig") ||
		basename.includes("package.json")
	) {
		return "config"
	}

	// Test files
	if (basename.includes(".test.") || basename.includes(".spec.") || basename.includes("__tests__")) {
		return "test-related"
	}

	// Default: dependency (will be refined by caller)
	return "dependency"
}

/**
 * Build a human-readable summary of the context bundle
 */
function buildSummary(userRequest: string, files: ContextFile[], activeFile?: string): string {
	const parts: string[] = []

	parts.push(`User request: ${userRequest.slice(0, 200)}${userRequest.length > 200 ? "..." : ""}`)

	if (files.length > 0) {
		parts.push(`Context includes ${files.length} file(s):`)
		for (const file of files) {
			const truncated = file.truncated ? " (truncated)" : ""
			parts.push(`  - ${path.basename(file.path)}${truncated} [${file.reason}]`)
		}
	}

	if (activeFile) {
		parts.push(`Active file: ${path.basename(activeFile)}`)
	}

	return parts.join("\n")
}

/**
 * Create a minimal context bundle for planner/reviewer
 * (lighter than full execution context)
 */
export async function buildMinimalContext(
	userRequest: string,
	activeFile?: string,
	selectedText?: string,
): Promise<ContextBundle> {
	return buildContextBundle({
		userRequest,
		activeFile,
		selectedText,
		maxTokens: 15_000, // Lighter budget for planner/reviewer
		maxFileLength: 8_000,
	})
}