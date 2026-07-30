import { readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"

import type { GraphicsProjectEvidence, GraphicsProjectProfile } from "@roo-code/types"

import { buildGraphicsArchitectureIndex } from "./GraphicsArchitectureIndex"

const MAX_SCANNED_FILES = 600
const EXCLUDED_DIRECTORIES = new Set([
	".git",
	".hg",
	".svn",
	"Library",
	"Temp",
	"Logs",
	"obj",
	"bin",
	"build",
	"dist",
	"node_modules",
	"PackagesCache",
])
const SHADER_EXTENSIONS = new Map([
	[".shader", "ShaderLab/HLSL"],
	[".hlsl", "HLSL"],
	[".hlsli", "HLSL"],
	[".compute", "HLSL Compute"],
	[".glsl", "GLSL"],
	[".vert", "GLSL"],
	[".frag", "GLSL"],
	[".metal", "Metal Shading Language"],
	[".usf", "Unreal Shader Files"],
	[".ush", "Unreal Shader Headers"],
	[".wgsl", "WGSL"],
])

interface ProjectFiles {
	relativePaths: string[]
	warnings: string[]
}

const toRelativePath = (workspacePath: string, filePath: string) =>
	path.relative(workspacePath, filePath).replaceAll("\\", "/")

async function fileExists(filePath: string): Promise<boolean> {
	try {
		return (await stat(filePath)).isFile()
	} catch {
		return false
	}
}

async function readText(filePath: string): Promise<string | undefined> {
	try {
		return await readFile(filePath, "utf8")
	} catch {
		return undefined
	}
}

async function collectProjectFiles(workspacePath: string): Promise<ProjectFiles> {
	const relativePaths: string[] = []
	const warnings: string[] = []
	const queue = [workspacePath]

	while (queue.length > 0 && relativePaths.length < MAX_SCANNED_FILES) {
		const directory = queue.shift()!
		let entries
		try {
			entries = await readdir(directory, { withFileTypes: true })
		} catch (error) {
			warnings.push(`Could not inspect ${toRelativePath(workspacePath, directory) || "."}: ${String(error)}`)
			continue
		}

		for (const entry of entries) {
			if (entry.name === ".env" || entry.name === ".rooignore") {
				continue
			}
			const absolutePath = path.join(directory, entry.name)
			if (entry.isDirectory()) {
				if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
					queue.push(absolutePath)
				}
			} else if (entry.isFile()) {
				relativePaths.push(toRelativePath(workspacePath, absolutePath))
				if (relativePaths.length >= MAX_SCANNED_FILES) {
					warnings.push(`Profile scan stopped after ${MAX_SCANNED_FILES} files; results may be incomplete.`)
					break
				}
			}
		}
	}

	return { relativePaths, warnings }
}

function addEvidence(evidence: GraphicsProjectEvidence[], path: string, description: string) {
	if (!evidence.some((item) => item.path === path && item.description === description)) {
		evidence.push({ path, description })
	}
}

export async function profileGraphicsProject(workspacePath?: string): Promise<GraphicsProjectProfile> {
	const profile: GraphicsProjectProfile = {
		version: 1,
		workspaceName: workspacePath ? path.basename(workspacePath) : "No workspace",
		engine: "unknown",
		renderPipelines: [],
		graphicsApis: [],
		targetPlatforms: [],
		shaderLanguages: [],
		architectureSignals: [],
		architectureIndex: {
			version: 1,
			findings: [],
			analyzedFileCount: 0,
			truncated: false,
		},
		evidence: [],
		warnings: [],
		scannedAt: new Date().toISOString(),
	}

	if (!workspacePath) {
		profile.warnings.push("Open a workspace to generate a Graphics Project Profile.")
		return profile
	}

	const { relativePaths, warnings } = await collectProjectFiles(workspacePath)
	profile.warnings.push(...warnings)
	profile.architectureIndex = await buildGraphicsArchitectureIndex(workspacePath, relativePaths)
	if (profile.architectureIndex.truncated) {
		profile.warnings.push("Deep architecture analysis reached its file limit; findings may be incomplete.")
	}
	for (const finding of profile.architectureIndex.findings) {
		addEvidence(profile.evidence, finding.path, finding.detail)
	}
	const lowerPaths = relativePaths.map((filePath) => filePath.toLowerCase())
	const projectVersionPath = "ProjectSettings/ProjectVersion.txt"
	const unityManifestPath = "Packages/manifest.json"
	const unrealProject = relativePaths.find((filePath) => filePath.toLowerCase().endsWith(".uproject"))

	if (await fileExists(path.join(workspacePath, projectVersionPath))) {
		profile.engine = "unity"
		const versionText = await readText(path.join(workspacePath, projectVersionPath))
		profile.engineVersion = versionText?.match(/m_EditorVersion:\s*([^\r\n]+)/)?.[1]?.trim()
		addEvidence(profile.evidence, projectVersionPath, "Unity project version")
	} else if (unrealProject) {
		profile.engine = "unreal"
		addEvidence(profile.evidence, unrealProject, "Unreal project descriptor")
	} else if (relativePaths.some((filePath) => SHADER_EXTENSIONS.has(path.extname(filePath).toLowerCase()))) {
		profile.engine = "custom"
		profile.warnings.push("Graphics source was detected, but the engine could not be identified confidently.")
	}

	const manifestText = await readText(path.join(workspacePath, unityManifestPath))
	if (manifestText) {
		addEvidence(profile.evidence, unityManifestPath, "Unity package manifest")
		if (manifestText.includes("com.unity.render-pipelines.universal")) profile.renderPipelines.push("Unity URP")
		if (manifestText.includes("com.unity.render-pipelines.high-definition"))
			profile.renderPipelines.push("Unity HDRP")
		if (manifestText.includes("com.unity.render-pipelines.core") && profile.renderPipelines.length === 0) {
			profile.renderPipelines.push("Unity Scriptable Render Pipeline")
		}
	}
	if (profile.engine === "unity" && profile.renderPipelines.length === 0)
		profile.renderPipelines.push("Unity Built-in or custom")
	if (profile.engine === "unreal") profile.renderPipelines.push("Unreal Renderer")

	for (const [extension, language] of SHADER_EXTENSIONS) {
		const shaderPath = relativePaths.find((filePath) => path.extname(filePath).toLowerCase() === extension)
		if (shaderPath) {
			profile.shaderLanguages.push(language)
			addEvidence(profile.evidence, shaderPath, `${language} source`)
		}
	}

	const architecturePatterns: Array<[RegExp, string]> = [
		[/rendererfeature|scriptablerenderpass/i, "Renderer Feature / Scriptable Render Pass"],
		[/custompass/i, "Custom Pass"],
		[/rendergraph/i, "Render Graph"],
		[/postprocess|post-process|post_processing/i, "Post-processing"],
		[/shadergraph/i, "Shader Graph"],
	]
	for (const [pattern, signal] of architecturePatterns) {
		const match = relativePaths.find((filePath) => pattern.test(filePath))
		if (match) {
			profile.architectureSignals.push(signal)
			addEvidence(profile.evidence, match, signal)
		}
	}

	const combinedPaths = lowerPaths.join("\n")
	if (/android|\.gradle|androidmanifest/.test(combinedPaths)) profile.targetPlatforms.push("Android")
	if (/ios|xcode|\.pbxproj/.test(combinedPaths)) profile.targetPlatforms.push("iOS")
	if (/windows|win64|directx|d3d/.test(combinedPaths)) profile.targetPlatforms.push("Windows")
	if (/vulkan/.test(combinedPaths)) profile.graphicsApis.push("Vulkan")
	if (/directx|d3d12|dx12/.test(combinedPaths)) profile.graphicsApis.push("DirectX 12")
	if (/d3d11|dx11/.test(combinedPaths)) profile.graphicsApis.push("DirectX 11")
	if (/metal/.test(combinedPaths)) profile.graphicsApis.push("Metal")
	if (/opengl|gles/.test(combinedPaths)) profile.graphicsApis.push("OpenGL")

	profile.renderPipelines = [...new Set(profile.renderPipelines)]
	profile.graphicsApis = [...new Set(profile.graphicsApis)]
	profile.targetPlatforms = [...new Set(profile.targetPlatforms)]
	profile.shaderLanguages = [...new Set(profile.shaderLanguages)]
	profile.architectureSignals = [...new Set(profile.architectureSignals)]
	return profile
}
