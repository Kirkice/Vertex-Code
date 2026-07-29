import * as fs from "fs/promises"
import * as path from "path"
import type { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { getGlobalRooDirectory } from "../roo-config"
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
	return discoverRagDocumentsFromRoots(
		[
			{ path: workspacePath, sourceType: "markdown", basePath: workspacePath },
			{ path: path.join(getGlobalRooDirectory(), "knowledge"), sourceType: "knowledge" },
		],
		workspacePath,
		ignoreController,
	)
}

export async function discoverRagDocumentsFromRoots(
	roots: RagDocumentRoot[],
	workspacePath: string,
	ignoreController?: RooIgnoreController,
): Promise<RagDocumentSource[]> {
	const files: string[] = []
	const sources: RagDocumentSource[] = []
	for (const root of roots) {
		files.length = 0
		await walk(root.path, files)
		const basePath = root.basePath ?? workspacePath
		const relativeFiles = files.map((filePath) => path.relative(basePath, filePath))
		const allowedFiles = ignoreController ? ignoreController.filterPaths(relativeFiles) : relativeFiles
		for (const relativePath of allowedFiles) {
			const extension = path.extname(relativePath).toLowerCase()
			const sourceType = root.sourceType === "knowledge" ? "knowledge" : EXTENSIONS.get(extension)
			if (!sourceType) continue
			sources.push({
				path: path.resolve(root.path, path.relative(root.path, path.join(basePath, relativePath))),
				sourceType,
			})
		}
	}
	return sources
}
