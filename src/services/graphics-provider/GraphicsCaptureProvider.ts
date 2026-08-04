/**
 * Graphics Capture Provider Interface
 *
 * This is the core abstraction for external graphics capture tools.
 * All graphics providers (RenderDoc MCP, custom MCPs, etc.) must implement
 * this interface to be usable by Vertex's graphics workflow layer.
 *
 * The workflow layer should ONLY depend on this interface, never on
 * concrete provider implementations or specific tool names.
 *
 * @module graphics-provider/GraphicsCaptureProvider
 */

import type {
	GraphicsProviderKind,
	GraphicsProviderId,
	GraphicsProviderCapabilities,
	GraphicsProviderStatusInfo,
	OpenCaptureResult,
	FrameSummaryResult,
	SelectionContextResult,
	EventDetailsResult,
	PipelineStateResult,
	ShaderInfoRequest,
	ShaderInfoResult,
	ShaderSourceRequest,
	ShaderSourceResult,
	ResourceHistoryRequest,
	ResourceHistoryResult,
	PipelineDiffRequest,
	PipelineDiffResult,
	LaunchTargetResult,
	LiveTargetResult,
	CaptureTriggerResult,
	CaptureCompletionResult,
	GraphicsLaunchProfile,
	GraphicsOperationContext,
	ProjectMappingRequest,
	ProjectMappingResult,
} from "./GraphicsProviderTypes"

/**
 * Core interface for graphics capture providers.
 *
 * Each provider represents an external graphics capture tool that can be
 * queried for frame data, shader information, pipeline state, etc.
 *
 * Providers are registered with the GraphicsProviderRegistry and can be
 * discovered automatically or configured manually by users.
 */
export interface GraphicsCaptureProvider {
	/** Unique identifier for this provider instance */
	readonly id: GraphicsProviderId

	/** Human-readable display name */
	readonly displayName: string

	/** How this provider connects to Vertex */
	readonly kind: GraphicsProviderKind

	/**
	 * Check if this provider is currently available and ready to use.
	 *
	 * This should verify:
	 * - The underlying MCP server or extension is running
	 * - Required tools/capabilities are accessible
	 * - A capture is open (if applicable)
	 *
	 * @returns true if the provider can accept requests
	 */
	isAvailable(): Promise<boolean>

	/**
	 * Get detailed status information about this provider.
	 *
	 * @returns Status info including availability and any error messages
	 */
	getStatus(): Promise<GraphicsProviderStatusInfo>

	/**
	 * Declare which capabilities this provider supports.
	 *
	 * Workflows should check required capabilities before execution
	 * using the preflight check mechanism.
	 *
	 * @returns The capabilities supported by this provider
	 */
	getCapabilities(): Promise<GraphicsProviderCapabilities>

	/** Launch and capture lifecycle operations are optional provider capabilities. */
	launchTarget?(profile: GraphicsLaunchProfile, context?: GraphicsOperationContext): Promise<LaunchTargetResult>
	waitForLiveTarget?(
		targetId: string,
		context?: GraphicsOperationContext,
	): Promise<LiveTargetResult>
	triggerCapture?(
		targetId: string,
		profile: GraphicsLaunchProfile,
		context?: GraphicsOperationContext,
	): Promise<CaptureTriggerResult>
	waitForCapture?(
		operationId: string,
		context?: GraphicsOperationContext,
	): Promise<CaptureCompletionResult>

	/**
	 * Open the current capture (if not already open).
	 *
	 * @returns Result indicating success/failure and capture metadata
	 */
	openCurrentCapture(): Promise<OpenCaptureResult>

	/**
	 * Retrieve a high-level summary of the current frame.
	 *
	 * This typically includes:
	 * - List of render passes
	 * - Overall frame timing
	 * - Hot (expensive) events
	 *
	 * @returns Frame summary data
	 */
	getFrameSummary(): Promise<FrameSummaryResult>

	/**
	 * Retrieve the currently selected draw/event context.
	 *
	 * This is used when the user has selected a specific draw call
	 * in the external tool's UI and wants to analyze it.
	 *
	 * @returns Selection context data
	 */
	getSelectionContext(): Promise<SelectionContextResult>

	/**
	 * Retrieve detailed information about a specific event.
	 *
	 * @param eventId - The event ID to query
	 * @returns Detailed event information
	 */
	getEventDetails(eventId: string | number): Promise<EventDetailsResult>

	/**
	 * Retrieve the pipeline state for a specific event.
	 *
	 * This includes render targets, depth stencil, vertex buffers,
	 * samplers, constant buffers, etc.
	 *
	 * @param eventId - The event ID to query
	 * @returns Pipeline state data
	 */
	getPipelineState(eventId: string | number): Promise<PipelineStateResult>

	/**
	 * Retrieve shader information for a specific event and stage.
	 *
	 * @param input - Request parameters including event ID and shader stage
	 * @returns Shader metadata and reflection data
	 */
	getShaderInfo(input: ShaderInfoRequest): Promise<ShaderInfoResult>

	/** Retrieve stable shader identity and source for a capture event. */
	getShaderSource(input: ShaderSourceRequest): Promise<ShaderSourceResult>

	/** Retrieve resource lifecycle evidence across capture events. */
	getResourceHistory(input: ResourceHistoryRequest): Promise<ResourceHistoryResult>

	/** Compare pipeline state fields between two events. */
	diffPipelineState(input: PipelineDiffRequest): Promise<PipelineDiffResult>

	/**
	 * Map a capture object back to project source code.
	 *
	 * This is used to find which code in the project is responsible
	 * for a particular shader, pass, draw call, or resource.
	 *
	 * @param input - Request parameters specifying what to map
	 * @returns Candidate source code locations
	 */
	findProjectImplementation(input: ProjectMappingRequest): Promise<ProjectMappingResult>
}

/**
 * Base class for graphics capture providers.
 *
 * Provides common functionality and default implementations for
 * optional methods. Concrete providers should extend this class.
 */
export abstract class BaseGraphicsCaptureProvider implements GraphicsCaptureProvider {
	abstract readonly id: GraphicsProviderId
	abstract readonly displayName: string
	abstract readonly kind: GraphicsProviderKind

	abstract isAvailable(): Promise<boolean>
	abstract getCapabilities(): Promise<GraphicsProviderCapabilities>
	abstract openCurrentCapture(): Promise<OpenCaptureResult>
	abstract getFrameSummary(): Promise<FrameSummaryResult>
	abstract getSelectionContext(): Promise<SelectionContextResult>
	abstract getEventDetails(eventId: string | number): Promise<EventDetailsResult>
	abstract getPipelineState(eventId: string | number): Promise<PipelineStateResult>
	abstract getShaderInfo(input: ShaderInfoRequest): Promise<ShaderInfoResult>

	async getShaderSource(_input: ShaderSourceRequest): Promise<ShaderSourceResult> {
		return { success: false, error: "Shader source is not supported by this provider." }
	}

	async getResourceHistory(_input: ResourceHistoryRequest): Promise<ResourceHistoryResult> {
		return { success: false, error: "Resource history is not supported by this provider." }
	}

	async diffPipelineState(_input: PipelineDiffRequest): Promise<PipelineDiffResult> {
		return { success: false, error: "Pipeline diff is not supported by this provider." }
	}

	abstract findProjectImplementation(input: ProjectMappingRequest): Promise<ProjectMappingResult>

	/**
	 * Default implementation returns a basic status info.
	 * Subclasses can override for more detailed status.
	 */
	async getStatus(): Promise<GraphicsProviderStatusInfo> {
		const available = await this.isAvailable()
		return {
			status: available ? "available" : "unavailable",
			providerId: this.id,
			providerName: this.displayName,
		}
	}
}
