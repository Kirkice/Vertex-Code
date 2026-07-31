import { readFile, stat } from "node:fs/promises"
import path from "node:path"

import type {
	GraphicsArchitectureFinding,
	GraphicsArchitectureGraphEdge,
	GraphicsArchitectureGraphNode,
	GraphicsArchitectureIndex,
	GraphicsSimilarFeature,
} from "@roo-code/types"

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
	".meta",
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

/**
 * Builds a bounded, deterministic Unity reference graph from the files already read by the index.
 * Meta files are included so a GUID can be resolved to the real project asset instead of remaining
 * an opaque token. The parser intentionally accepts Unity YAML and serialized C# field syntax.
 */
function buildReferenceGraph(files: Map<string, string>): {
	nodes: GraphicsArchitectureGraphNode[]
	edges: GraphicsArchitectureGraphEdge[]
} {
	const nodes = new Map<string, GraphicsArchitectureGraphNode>()
	const edges = new Map<string, GraphicsArchitectureGraphEdge>()
	const guidToAssetPath = new Map<string, string>()
	const addNode = (node: GraphicsArchitectureGraphNode) => nodes.set(node.id, node)
	const addEdge = (edge: GraphicsArchitectureGraphEdge) => {
		const key = `${edge.from}:${edge.to}:${edge.kind}:${edge.detail ?? ""}`
		edges.set(key, edge)
	}

	// Unity stores the GUID of an asset in its adjacent .meta file.
	for (const [relativePath, content] of files) {
		if (!relativePath.endsWith(".meta")) continue
		const guid = content.match(/^guid:\s*([a-f0-9]{32})\s*$/im)?.[1]?.toLowerCase()
		if (guid) guidToAssetPath.set(guid, relativePath.slice(0, -5))
	}

	const describeGuidReference = (sourcePath: string, sourceContent: string, targetPath?: string): string => {
		if (sourcePath.endsWith("ProjectSettings/GraphicsSettings.asset")) {
			return "Resolved Render Pipeline Asset GUID"
		}
		if (sourceContent.includes("m_RendererDataList") && targetPath) {
			return "Resolved Renderer Data asset GUID"
		}
		if (sourceContent.includes("m_RendererFeatures") && targetPath) {
			return "Resolved Renderer Feature asset GUID"
		}
		return targetPath ? "Resolved Unity asset GUID" : "Unresolved Unity GUID"
	}

	for (const [relativePath, content] of files) {
		const fileId = `file:${relativePath}`
		addNode({ id: fileId, kind: "file", label: path.basename(relativePath), path: relativePath })

		if (!relativePath.endsWith(".meta")) {
			const extension = path.extname(relativePath).toLowerCase()
			if (
				extension === ".asset" ||
				extension === ".shader" ||
				extension === ".shadergraph" ||
				extension === ".compute"
			) {
				const assetId = `asset:${relativePath}`
				addNode({ id: assetId, kind: "asset", label: path.basename(relativePath), path: relativePath })
				addEdge({ from: fileId, to: assetId, kind: "contains", detail: "Graphics asset" })
			}
		}

		const guidPattern = /(?:guid|m_GUID)\s*[:=]\s*([a-f0-9]{32})/gi
		for (const match of content.matchAll(guidPattern)) {
			const guid = match[1].toLowerCase()
			const resolvedPath = guidToAssetPath.get(guid)
			const targetId = resolvedPath ? `file:${resolvedPath}` : `guid:${guid}`
			if (!nodes.has(targetId)) {
				addNode(
					resolvedPath
						? { id: targetId, kind: "asset", label: path.basename(resolvedPath), path: resolvedPath, guid }
						: { id: targetId, kind: "guid", label: guid, guid },
				)
			}
			addEdge({
				from: fileId,
				to: targetId,
				kind: "references",
				detail: describeGuidReference(relativePath, content, resolvedPath),
			})
		}

		for (const include of content.matchAll(/#include\s*[<"]([^>"]+)[>"]/gi)) {
			const includePath = include[1].replaceAll("\\", "/")
			const includeId = `symbol:include:${includePath}`
			addNode({ id: includeId, kind: "symbol", label: includePath })
			addEdge({ from: fileId, to: includeId, kind: "includes", detail: "Shader include" })
		}

		// These symbols provide enough structure for feature matching without requiring a compiler.
		for (const pass of content.matchAll(/\bPass\s*\{[^}]*?(?:Name\s+"([^"]+)"|LightMode"?\s*=\s*"([^"]+)")/gis)) {
			const label = pass[1] ?? pass[2]
			const symbolId = `symbol:pass:${relativePath}:${label}`
			addNode({ id: symbolId, kind: "symbol", label })
			addEdge({ from: fileId, to: symbolId, kind: "contains", detail: "Shader pass" })
		}
		for (const keyword of content.matchAll(/#pragma\s+(?:multi_compile|shader_feature(?:_local)?)\s+([^\r\n]+)/gi)) {
			const label = keyword[1].trim()
			const symbolId = `symbol:keyword:${relativePath}:${label}`
			addNode({ id: symbolId, kind: "symbol", label })
			addEdge({ from: fileId, to: symbolId, kind: "implements", detail: "Shader variant keyword" })
		}
		// Capture common HLSL/GLSL entry signatures as well as Unity surface types.
		// This deliberately remains compiler-free so incomplete shader edits are still indexable.
		for (const symbol of content.matchAll(
			/\b(?:void|bool|half|half\d|float|float\d|double|uint|int|SurfaceData|VertexPositionInputs|FragmentOutput)\s+(\w+)\s*\(/g,
		)) {
			const symbolId = `symbol:entry:${relativePath}:${symbol[1]}`
			addNode({ id: symbolId, kind: "symbol", label: symbol[1] })
			addEdge({ from: fileId, to: symbolId, kind: "implements", detail: "Shader or client entry point" })
		}
		for (const symbol of content.matchAll(/\b(?:class|struct|interface|enum)\s+(\w+)/g)) {
			const symbolId = `symbol:type:${relativePath}:${symbol[1]}`
			addNode({ id: symbolId, kind: "symbol", label: symbol[1] })
			addEdge({ from: fileId, to: symbolId, kind: "contains", detail: "Source type symbol" })
		}
	}
	return { nodes: [...nodes.values()], edges: [...edges.values()] }
}

/**
 * Ranks files that can serve as reusable feature references. Scores are deliberately explainable:
 * architecture breadth, distinct findings, and named symbols each contribute a fixed amount.
 */
function rankSimilarFeatures(findings: GraphicsArchitectureFinding[]): GraphicsSimilarFeature[] {
	const byPath = new Map<string, GraphicsArchitectureFinding[]>()
	for (const finding of findings) byPath.set(finding.path, [...(byPath.get(finding.path) ?? []), finding])

	return [...byPath.entries()]
		.map(([featurePath, pathFindings]) => {
			const categories = new Set(pathFindings.map((finding) => finding.category))
			const symbols = pathFindings.filter((finding) => finding.symbol).length
			const score = Math.min(100, categories.size * 20 + pathFindings.length * 5 + symbols * 3)
			return {
				id: `feature:${featurePath}`,
				label: path.basename(featurePath, path.extname(featurePath)),
				score,
				evidence: [...new Set(pathFindings.map((finding) => `${finding.kind}: ${finding.detail}`))].slice(0, 6),
			}
		})
		.filter((feature) => feature.score > 0)
		.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
		.slice(0, 20)
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
	const analyzedFiles = new Map<string, string>()
	let analyzedFileCount = 0

	for (const relativePath of selectedCandidates) {
		const content = await readAnalyzableFile(workspacePath, relativePath, maxFileBytes)
		if (content === undefined) continue
		analyzedFileCount += 1
		analyzedFiles.set(relativePath, content)
		for (const analyzer of analyzers) {
			findings.push(...analyzer.analyze({ path: relativePath, content }))
		}
	}

	const uniqueFindings = deduplicateFindings(findings)
	const graph = buildReferenceGraph(analyzedFiles)
	return {
		version: 1,
		findings: uniqueFindings,
		analyzedFileCount,
		truncated: candidates.length > selectedCandidates.length,
		graph,
		similarFeatures: rankSimilarFeatures(uniqueFindings),
	}
}
