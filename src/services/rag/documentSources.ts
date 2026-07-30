import * as fs from "fs/promises"
import * as path from "path"
import type { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { getGlobalRooDirectory } from "../roo-config"
import { KNOWLEDGE_DIR } from "../knowledge/knowledgeLoader"
import type { KnowledgeSourceType } from "./types"

export interface RagDocumentSource {
	path: string
	sourceType: KnowledgeSourceType
}

export interface RagDocumentRoot {
	path: string
	sourceType: KnowledgeSourceType
	basePath?: string
}

const EXTENSIONS = new Map<string, KnowledgeSourceType>([
	[".md", "markdown"],
	[".markdown", "markdown"],
	[".txt", "text"],
])

async function walk(directory: string, result: string[]): Promise<void> {
	let entries
	try {
		entries = await fs.readdir(directory, { withFileTypes: true })
	} catch {
		return
	}
	for (const entry of entries) {
		if (entry.name.startsWith(".") && entry.name !== ".roo") continue
		if (["node_modules", "dist", "build", "out", ".git"].includes(entry.name)) continue
		const entryPath = path.join(directory, entry.name)
		if (entry.isDirectory()) await walk(entryPath, result)
		else result.push(entryPath)
	}
}

export async function discoverRagDocuments(
	workspacePath: string,
	ignoreController?: RooIgnoreController,
): Promise<RagDocumentSource[]> {
	return discoverRagDocumentsFromRoots(defaultRagDocumentRoots(workspacePath), workspacePath, ignoreController)
}

/**
 * Builds the default RAG document roots: the workspace itself plus the
 * global (`~/.roo/knowledge`) and built-in bundled knowledge directories.
 * Duplicate root paths are removed so overlapping locations are not scanned twice.
 */
export function defaultRagDocumentRoots(workspacePath: string): RagDocumentRoot[] {
	const roots: RagDocumentRoot[] = [
		{ path: workspacePath, sourceType: "markdown", basePath: workspacePath },
		{ path: path.join(getGlobalRooDirectory(), "knowledge"), sourceType: "knowledge" },
		{ path: KNOWLEDGE_DIR, sourceType: "knowledge" },
	]
	const seen = new Set<string>()
	return roots.filter((root) => {
		const key = path.resolve(root.path)
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

export async function discoverRagDocumentsFromRoots(
	roots: RagDocumentRoot[],
	workspacePath: string,
	ignoreController?: RooIgnoreController,
): Promise<RagDocumentSource[]> {
	const sources: RagDocumentSource[] = []
	const seen = new Set<string>()
	for (const root of roots) {
		const files: string[] = []
		await walk(root.path, files)
		const isWorkspaceRoot = path.resolve(root.path) === path.resolve(workspacePath)
		for (const absolutePath of files) {
			const extension = path.extname(absolutePath).toLowerCase()
			const sourceType = root.sourceType === "knowledge" ? "knowledge" : EXTENSIONS.get(extension)
			if (!sourceType) continue
			if (isWorkspaceRoot) {
				// Workspace files are stored relative to the workspace and optionally
				// filtered by .rooignore.
				const relativePath = path.relative(workspacePath, absolutePath)
				if (ignoreController && !ignoreController.filterPaths([relativePath]).length) continue
				if (!seen.has(relativePath)) {
					seen.add(relativePath)
					sources.push({ path: relativePath, sourceType })
				}
			} else {
				// External knowledge roots are outside the workspace ignore scope and
				// stored as absolute paths.
				if (!seen.has(absolutePath)) {
					seen.add(absolutePath)
					sources.push({ path: absolutePath, sourceType })
				}
			}
		}
	}
	return sources
}
