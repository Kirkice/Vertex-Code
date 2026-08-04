/** AssetStudio MCP adapter for structured Unity asset inspection. */

import { access } from "node:fs/promises"
import type { McpHubLike } from "../renderdoc-vscode-mcp/RenderDocVsCodeMcpProvider"
import type { GraphicsAssetProvider } from "../../GraphicsAssetProvider"
import type {
	GraphicsAssetArtifact,
	GraphicsAssetInventory,
	GraphicsAssetProviderCapabilities,
	GraphicsAssetProviderOptions,
	GraphicsAssetProviderStatus,
	GraphicsAssetResult,
	GraphicsAssetToolNames,
	GraphicsBuildAssetMemory,
	GraphicsBundleDependencies,
	GraphicsMaterialContract,
	GraphicsMeshAnalysis,
	GraphicsRendererConfiguration,
	GraphicsSerializedComponent,
	GraphicsTextureAnalysis,
} from "../../GraphicsAssetTypes"

const DEFAULT_SERVER_NAMES = ["asset-studio-mcp", "asset-studio", "assetstudio"] as const
const DEFAULT_TOOLS: GraphicsAssetToolNames = {
	loadArtifact: "assetStudio_loadArtifact",
	getAssetInventory: "assetStudio_getAssetInventory",
	analyzeTexture: "assetStudio_analyzeTexture",
	analyzeMesh: "assetStudio_analyzeMesh",
	getMaterialContract: "assetStudio_getMaterialContract",
	getRendererConfiguration: "assetStudio_getRendererConfiguration",
	getBuildAssetMemory: "assetStudio_getBuildAssetMemory",
	getBundleDependencies: "assetStudio_getBundleDependencies",
	readSerializedComponent: "assetStudio_readSerializedComponent",
}

export const ASSET_STUDIO_CAPABILITIES = [
	"asset.loadArtifact",
	"asset.inventory",
	"asset.texture",
	"asset.mesh",
	"asset.material",
	"asset.renderer",
	"asset.memory",
	"asset.dependencies",
	"asset.serializedComponent",
	"asset.audit",
] as const

export function parseAssetStudioToolResult(result: unknown): unknown {
	if (!result || typeof result !== "object") return result
	const candidate = result as { content?: unknown; result?: unknown; structuredContent?: unknown }
	if (candidate.structuredContent !== undefined) return candidate.structuredContent
	if (candidate.result !== undefined && !Array.isArray(candidate.result)) return candidate.result
	if (Array.isArray(candidate.content)) {
		const text = candidate.content
			.filter((item): item is { type?: string; text?: string } => typeof item === "object" && item !== null)
			.filter((item) => item.type === "text" && typeof item.text === "string")
			.map((item) => item.text)
			.join("\n")
		if (!text) return result
		try {
			return JSON.parse(text)
		} catch {
			return text
		}
	}
	return result
}

export class AssetStudioMcpProvider implements GraphicsAssetProvider {
	readonly id = "asset-studio-mcp"
	readonly displayName = "AssetStudio MCP"
	readonly kind = "mcp" as const

	private serverName: string | undefined
	private artifactId: string | undefined
	private readonly tools: GraphicsAssetToolNames
	private readonly serverNames: readonly string[]

	constructor(
		private readonly mcpHub: McpHubLike,
		private readonly options: GraphicsAssetProviderOptions = {},
	) {
		this.tools = { ...DEFAULT_TOOLS, ...options.toolNames }
		this.serverNames = options.serverNames ?? DEFAULT_SERVER_NAMES
	}

	async getStatus(): Promise<GraphicsAssetProviderStatus> {
		const checkedAt = new Date().toISOString()
		const diagnostics: string[] = []
		const packageDiagnostics = await this.checkLocalPackage()
		diagnostics.push(...packageDiagnostics)
		const serverName = this.findServerName()
		if (!serverName) {
			return {
				providerId: this.id,
				providerName: this.displayName,
				availability: packageDiagnostics.length && this.options.allowRemoteMcp ? "degraded" : "unavailable",
				health: "unavailable",
				message: "AssetStudio MCP server is not connected.",
				diagnostics: [...diagnostics, "No configured AssetStudio MCP server was discovered."],
				checkedAt,
			}
		}
		this.serverName = serverName
		try {
			await this.call(this.options.healthProbeTool ?? this.tools.getAssetInventory, {})
			return {
				providerId: this.id,
				providerName: this.displayName,
				availability: packageDiagnostics.length ? "degraded" : "available",
				health: packageDiagnostics.length ? "degraded" : "healthy",
				serverName,
				message: packageDiagnostics.length ? "AssetStudio is connected with runtime diagnostics." : undefined,
				diagnostics,
				checkedAt,
			}
		} catch (error) {
			return {
				providerId: this.id,
				providerName: this.displayName,
				availability: "degraded",
				health: "degraded",
				serverName,
				message: "AssetStudio MCP server was discovered but the health probe failed.",
				diagnostics: [...diagnostics, error instanceof Error ? error.message : String(error)],
				checkedAt,
			}
		}
	}

	async isAvailable(): Promise<boolean> {
		const status = await this.getStatus()
		return status.availability !== "unavailable"
	}

	async getCapabilities(): Promise<GraphicsAssetProviderCapabilities> {
		const available = await this.isAvailable()
		return {
			loadArtifact: available,
			assetInventory: available,
			texture: available,
			mesh: available,
			material: available,
			renderer: available,
			memory: available,
			dependencies: available,
			serializedComponent: available,
			audit: available,
		}
	}

	async loadArtifact(path: string, kind?: string): Promise<GraphicsAssetResult<GraphicsAssetArtifact>> {
		return this.invoke<GraphicsAssetArtifact>(this.tools.loadArtifact, { path, kind })
	}
	async getAssetInventory(artifactId?: string): Promise<GraphicsAssetResult<GraphicsAssetInventory>> {
		return this.invoke<GraphicsAssetInventory>(this.tools.getAssetInventory, { artifactId: artifactId ?? this.artifactId })
	}
	async analyzeTexture(assetId: string, artifactId?: string): Promise<GraphicsAssetResult<GraphicsTextureAnalysis>> {
		return this.invoke<GraphicsTextureAnalysis>(this.tools.analyzeTexture, { assetId, artifactId: artifactId ?? this.artifactId })
	}
	async analyzeMesh(assetId: string, artifactId?: string): Promise<GraphicsAssetResult<GraphicsMeshAnalysis>> {
		return this.invoke<GraphicsMeshAnalysis>(this.tools.analyzeMesh, { assetId, artifactId: artifactId ?? this.artifactId })
	}
	async getMaterialContract(assetId: string, artifactId?: string): Promise<GraphicsAssetResult<GraphicsMaterialContract>> {
		return this.invoke<GraphicsMaterialContract>(this.tools.getMaterialContract, { assetId, artifactId: artifactId ?? this.artifactId })
	}
	async getRendererConfiguration(assetId: string, artifactId?: string): Promise<GraphicsAssetResult<GraphicsRendererConfiguration>> {
		return this.invoke<GraphicsRendererConfiguration>(this.tools.getRendererConfiguration, { assetId, artifactId: artifactId ?? this.artifactId })
	}
	async getBuildAssetMemory(artifactId?: string): Promise<GraphicsAssetResult<GraphicsBuildAssetMemory>> {
		return this.invoke<GraphicsBuildAssetMemory>(this.tools.getBuildAssetMemory, { artifactId: artifactId ?? this.artifactId })
	}
	async getBundleDependencies(artifactId?: string): Promise<GraphicsAssetResult<GraphicsBundleDependencies>> {
		return this.invoke<GraphicsBundleDependencies>(this.tools.getBundleDependencies, { artifactId: artifactId ?? this.artifactId })
	}
	async readSerializedComponent(assetId: string, componentType?: string, artifactId?: string): Promise<GraphicsAssetResult<GraphicsSerializedComponent>> {
		return this.invoke<GraphicsSerializedComponent>(this.tools.readSerializedComponent, { assetId, componentType, artifactId: artifactId ?? this.artifactId })
	}

	private findServerName(): string | undefined {
		const servers = this.mcpHub.getServers()
		return this.serverNames.find((name) => servers.some((server) => server.name === name && !server.disabled))
	}

	private async call(toolName: string, args: Record<string, unknown>): Promise<unknown> {
		const serverName = this.serverName ?? this.findServerName()
		if (!serverName) throw new Error("AssetStudio MCP server is unavailable")
		this.serverName = serverName
		return parseAssetStudioToolResult(await this.mcpHub.callTool(serverName, toolName, args))
	}

	private async invoke<T>(toolName: string, args: Record<string, unknown>): Promise<GraphicsAssetResult<T>> {
		try {
			const data = (await this.call(toolName, omitUndefined(args))) as T
			if (toolName === this.tools.loadArtifact && data && typeof data === "object" && "artifactId" in data) {
				this.artifactId = String((data as unknown as GraphicsAssetArtifact).artifactId)
			}
			return { success: true, data }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : String(error) }
		}
	}

	private async checkLocalPackage(): Promise<string[]> {
		const diagnostics: string[] = []
		if (this.options.executablePath) {
			try { await access(this.options.executablePath) } catch { diagnostics.push(`Executable not found: ${this.options.executablePath}`) }
		}
		for (const requiredFile of this.options.requiredFiles ?? []) {
			try { await access(requiredFile) } catch { diagnostics.push(`Required runtime file not found: ${requiredFile}`) }
		}
		return diagnostics
	}
}

function omitUndefined(values: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))
}
