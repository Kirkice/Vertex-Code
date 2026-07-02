/**
 * RenderDoc for VS Code MCP Provider
 *
 * Adapter that implements GraphicsCaptureProvider by delegating to
 * the renderdoc-for-vscode MCP server through McpHub.
 *
 * This provider:
 * - Discovers the renderdoc-for-vscode MCP server in McpHub connections
 * - Maps renderdoc_* tool calls to GraphicsCaptureProvider methods
 * - Handles availability detection and error normalization
 *
 * @module graphics-provider/providers/renderdoc-vscode-mcp
 */

import { BaseGraphicsCaptureProvider } from "../../GraphicsCaptureProvider"
import type {
	GraphicsProviderCapabilities,
	GraphicsProviderStatusInfo,
	OpenCaptureResult,
	FrameSummaryResult,
	SelectionContextResult,
	EventDetailsResult,
	PipelineStateResult,
	ShaderInfoRequest,
	ShaderInfoResult,
	ProjectMappingRequest,
	ProjectMappingResult,
} from "../../GraphicsProviderTypes"
import { emptyCapabilities } from "../../GraphicsProviderTypes"
import { GraphicsProviderError } from "../../GraphicsProviderError"

/**
 * Interface for McpHub tool calling capability.
 * This decouples the provider from the full McpHub class.
 */
export interface McpHubLike {
	callTool(
		serverName: string,
		toolName: string,
		toolArguments?: Record<string, unknown>,
	): Promise<any>
	getServers(): Array<{ name: string; disabled?: boolean }>
}

/**
 * Known MCP server names for renderdoc-for-vscode.
 */
const KNOWN_SERVER_NAMES = [
	"renderdoc-for-vscode",
	"renderdoc",
	"renderdoc-mcp",
]

/**
 * Tool name mapping from provider methods to renderdoc_* MCP tools.
 */
const TOOL_NAMES = {
	openCapture: "renderdoc_openCapture",
	getCaptureInfo: "renderdoc_getCaptureInfo",
	getFrameSummary: "renderdoc_getFrameSummary",
	getPassGraph: "renderdoc_getPassGraph",
	getActionTimings: "renderdoc_getActionTimings",
	getSelectionContext: "renderdoc_getSelectionContext",
	getEventDetails: "renderdoc_getEventDetails",
	getPipelineState: "renderdoc_getPipelineState",
	getShaderInfo: "renderdoc_getShaderInfo",
	getShaderSource: "renderdoc_getShaderSource",
	getMeshData: "renderdoc_getMeshData",
	findProjectImplementation: "renderdoc_findProjectImplementation",
	getDrawCalls: "renderdoc_getDrawCalls",
	analyzeHotEvent: "renderdoc_analyzeHotEvent",
	diffPipelineState: "renderdoc_diffPipelineState",
} as const

/**
 * RenderDoc for VS Code MCP provider implementation.
 */
export class RenderDocVsCodeMcpProvider extends BaseGraphicsCaptureProvider {
	readonly id = "renderdoc-vscode-mcp"
	readonly displayName = "RenderDoc for VS Code"
	readonly kind = "mcp" as const

	private serverName: string | null = null

	constructor(private readonly mcpHub: McpHubLike) {
		super()
	}

	/**
	 * Find the renderdoc MCP server name in the current connections.
	 */
	private findServerName(): string | null {
		const servers = this.mcpHub.getServers()
		for (const name of KNOWN_SERVER_NAMES) {
			const server = servers.find(
				(s) => s.name === name && !s.disabled,
			)
			if (server) {
				return server.name
			}
		}
		return null
	}

	/**
	 * Call a renderdoc MCP tool with error handling.
	 */
	private async callRenderDocTool(
		toolName: string,
		args?: Record<string, unknown>,
	): Promise<any> {
		if (!this.serverName) {
			this.serverName = this.findServerName()
		}
		if (!this.serverName) {
			throw new GraphicsProviderError(
				"RenderDoc for VS Code MCP server is not available. Please install and start the renderdoc-for-vscode extension.",
				"PROVIDER_UNAVAILABLE",
				{ providerId: this.id },
			)
		}

		try {
			const result = await this.mcpHub.callTool(this.serverName, toolName, args)
			return this.parseToolResult(result)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			if (message.includes("No connection found")) {
				throw new GraphicsProviderError(
					"RenderDoc MCP server is not connected. Please ensure the extension is running.",
					"PROVIDER_UNAVAILABLE",
					{ providerId: this.id, toolName, cause: error instanceof Error ? error : undefined },
				)
			}
			throw new GraphicsProviderError(
				`RenderDoc tool call failed: ${message}`,
				"TOOL_CALL_FAILED",
				{ providerId: this.id, toolName, cause: error instanceof Error ? error : undefined },
			)
		}
	}

	/**
	 * Parse MCP tool result, extracting content from the standard MCP response format.
	 */
	private parseToolResult(result: any): any {
		if (!result) {
			return null
		}
		// MCP tools return { content: [{ type: "text", text: "..." }] }
		if (result.content && Array.isArray(result.content)) {
			const textContent = result.content
				.filter((c: any) => c.type === "text")
				.map((c: any) => c.text)
				.join("\n")
			try {
				return JSON.parse(textContent)
			} catch {
				return textContent
			}
		}
		return result
	}

	async isAvailable(): Promise<boolean> {
		const name = this.findServerName()
		if (!name) {
			return false
		}
		this.serverName = name
		// Try a lightweight call to verify connectivity
		try {
			await this.callRenderDocTool(TOOL_NAMES.getCaptureInfo)
			return true
		} catch {
			// Server exists but may not have a capture open — still "available"
			return true
		}
	}

	override async getStatus(): Promise<GraphicsProviderStatusInfo> {
		const name = this.findServerName()
		if (!name) {
			return {
				status: "unavailable",
				message: "RenderDoc for VS Code MCP server not found in connections.",
				providerId: this.id,
				providerName: this.displayName,
			}
		}
		this.serverName = name

		try {
			await this.callRenderDocTool(TOOL_NAMES.getCaptureInfo)
			return {
				status: "available",
				providerId: this.id,
				providerName: this.displayName,
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			if (message.includes("no capture") || message.includes("No capture")) {
				return {
					status: "no-capture",
					message: "RenderDoc is running but no capture is open.",
					providerId: this.id,
					providerName: this.displayName,
				}
			}
			return {
				status: "error",
				message,
				providerId: this.id,
				providerName: this.displayName,
			}
		}
	}

	async getCapabilities(): Promise<GraphicsProviderCapabilities> {
		// RenderDoc for VS Code supports a comprehensive set of capabilities
		return {
			...emptyCapabilities(),
			frameSummary: true,
			selectionContext: true,
			eventDetails: true,
			pipelineState: true,
			shaderInfo: true,
			shaderSource: true,
			meshData: true,
			resourceDetail: true,
			textureData: true,
			bufferData: true,
			passGraph: true,
			projectMapping: true,
			captureDiff: true,
		}
	}

	async openCurrentCapture(): Promise<OpenCaptureResult> {
		try {
			const data = await this.callRenderDocTool(TOOL_NAMES.openCapture)
			return {
				success: true,
				capturePath: data?.capturePath ?? data?.path,
				api: data?.api,
				frameCount: data?.frameCount,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	async getFrameSummary(): Promise<FrameSummaryResult> {
		try {
			const data = await this.callRenderDocTool(TOOL_NAMES.getFrameSummary)
			return {
				success: true,
				passes: data?.passes,
				totalDurationMs: data?.totalDurationMs ?? data?.durationMs,
				hotEvents: data?.hotEvents ?? data?.topEvents,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	async getSelectionContext(): Promise<SelectionContextResult> {
		try {
			const data = await this.callRenderDocTool(TOOL_NAMES.getSelectionContext)
			return {
				success: true,
				eventId: data?.eventId ?? data?.selectedEventId,
				eventName: data?.eventName ?? data?.name,
				passName: data?.passName,
				drawType: data?.drawType,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	async getEventDetails(eventId: string | number): Promise<EventDetailsResult> {
		try {
			const data = await this.callRenderDocTool(TOOL_NAMES.getEventDetails, { eventId })
			return {
				success: true,
				eventId: data?.eventId ?? Number(eventId),
				name: data?.name ?? data?.eventName,
				durationMs: data?.durationMs,
				drawCallCount: data?.drawCallCount,
				primitiveCount: data?.primitiveCount,
				shaderStages: data?.shaderStages,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	async getPipelineState(eventId: string | number): Promise<PipelineStateResult> {
		try {
			const data = await this.callRenderDocTool(TOOL_NAMES.getPipelineState, { eventId })
			return {
				success: true,
				eventId: data?.eventId ?? Number(eventId),
				renderTargets: data?.renderTargets,
				depthStencil: data?.depthStencil,
				vertexBuffers: data?.vertexBuffers,
				samplers: data?.samplers,
				constantBuffers: data?.constantBuffers,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	async getShaderInfo(input: ShaderInfoRequest): Promise<ShaderInfoResult> {
		try {
			const data = await this.callRenderDocTool(TOOL_NAMES.getShaderInfo, {
				eventId: input.eventId,
				stage: input.stage,
			})
			return {
				success: true,
				eventId: data?.eventId ?? Number(input.eventId),
				stage: data?.stage ?? input.stage,
				entryPoint: data?.entryPoint,
				language: data?.language,
				instructionCount: data?.instructionCount,
				inputs: data?.inputs,
				outputs: data?.outputs,
				constantBuffers: data?.constantBuffers,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	async findProjectImplementation(input: ProjectMappingRequest): Promise<ProjectMappingResult> {
		try {
			const data = await this.callRenderDocTool(TOOL_NAMES.findProjectImplementation, {
				kind: input.kind,
				identifier: input.identifier,
				eventId: input.eventId,
			})
			return {
				success: true,
				candidates: data?.candidates ?? data?.results,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}
}
