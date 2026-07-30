import { readFile, stat } from "node:fs/promises"
import path from "node:path"

import type { GraphicsArchitectureFinding, GraphicsArchitectureIndex } from "@roo-code/types"

import { defaultGraphicsArchitectureAnalyzers, type GraphicsArchitectureAnalyzer } from "./analyzers"

const DEFAULT_MAX_ANALYZED_FILES = 160
const DEFAULT_MAX_FILE_BYTES = 512 * 1024
const ANALYZABLE_EXTENSIONS = new Set([
	".asset",
	".compute",
	".cs",
	".glsl",
	".hlsl",
	".hlsli",
	".json",
	".metal",
	".shader",
	".shadergraph",
	".txt",
	".usf",
	".ush",
	".wgsl",
	".yaml",
	".yml",
])

export interface GraphicsArchitectureIndexOptions {
	analyzers?: readonly GraphicsArchitectureAnalyzer[]
	maxAnalyzedFiles?: number
	maxFileBytes?: number
}

const normalizePath = (relativePath: string) => relativePath.replaceAll("\\", "/")

const prioritizeProjectPath = (relativePath: string) =>
	relativePath.startsWith("ProjectSettings/") || relativePath.startsWith("Assets/") ? 0 : 1

async function readAnalyzableFile(
	workspacePath: string,
	relativePath: string,
	maxFileBytes: number,
): Promise<string | undefined> {
	const absolutePath = path.join(workspacePath, relativePath)
	try {
		const fileStat = await stat(absolutePath)
		if (!fileStat.isFile() || fileStat.size > maxFileBytes) return undefined
		return await readFile(absolutePath, "utf8")
	} catch {
		return undefined
	}
}

function findingIdentity(finding: GraphicsArchitectureFinding): string {
	return [finding.category, finding.path, finding.kind, finding.symbol ?? ""].join(":")
}

function deduplicateFindings(findings: GraphicsArchitectureFinding[]): GraphicsArchitectureFinding[] {
	const uniqueFindings = new Map<string, GraphicsArchitectureFinding>()
	for (const finding of findings) {
		uniqueFindings.set(findingIdentity(finding), finding)
	}
	return [...uniqueFindings.values()]
}

export async function buildGraphicsArchitectureIndex(
	workspacePath: string,
	relativePaths: string[],
	options: GraphicsArchitectureIndexOptions = {},
): Promise<GraphicsArchitectureIndex> {
	const analyzers = options.analyzers ?? defaultGraphicsArchitectureAnalyzers
	const maxAnalyzedFiles = options.maxAnalyzedFiles ?? DEFAULT_MAX_ANALYZED_FILES
	const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES
	const candidates = relativePaths
		.map(normalizePath)
		.filter((relativePath) => ANALYZABLE_EXTENSIONS.has(path.extname(relativePath).toLowerCase()))
		.sort((left, right) => prioritizeProjectPath(left) - prioritizeProjectPath(right) || left.localeCompare(right))

	const selectedCandidates = candidates.slice(0, maxAnalyzedFiles)
	const findings: GraphicsArchitectureFinding[] = []
	let analyzedFileCount = 0

	for (const relativePath of selectedCandidates) {
		const content = await readAnalyzableFile(workspacePath, relativePath, maxFileBytes)
		if (content === undefined) continue
		analyzedFileCount += 1
		for (const analyzer of analyzers) {
			findings.push(...analyzer.analyze({ path: relativePath, content }))
		}
	}

	return {
		version: 1,
		findings: deduplicateFindings(findings),
		analyzedFileCount,
		truncated: candidates.length > selectedCandidates.length,
	}
}
