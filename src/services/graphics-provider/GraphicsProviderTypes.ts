/**
 * Graphics Provider Types
 *
 * Core type definitions for the graphics capture provider abstraction layer.
 * These types define the contract between Vertex's graphics workflow layer
 * and external graphics capture tools (RenderDoc, custom MCPs, etc.).
 *
 * @module graphics-provider/types
 */

// ─── Provider Identity ───────────────────────────────────────────────────────

/**
 * How the provider connects to Vertex.
 * - `mcp`: Pure MCP server connection
 * - `extension-bridge`: VS Code extension command bridge
 * - `hybrid`: Combination of MCP + extension commands
 */
export type GraphicsProviderKind = "mcp" | "extension-bridge" | "hybrid"

/**
 * Unique identifier for a graphics provider instance.
 */
export type GraphicsProviderId = string

// ─── Provider Capabilities ───────────────────────────────────────────────────

/**
 * Declares which capabilities a provider supports.
 * Not all providers implement every capability — workflows should check
 * required capabilities before execution via preflight checks.
 */
export interface GraphicsProviderCapabilities {
	/** Can retrieve frame-level summary (pass list, timings overview) */
	frameSummary: boolean
	/** Can launch a configured Windows or Android target. */
	launchTarget?: boolean
	/** Can observe a launched target becoming available for capture. */
	liveTarget?: boolean
	/** Can trigger a capture according to a launch profile policy. */
	captureTrigger?: boolean
	/** Can poll for capture completion. */
	capturePolling?: boolean
	/** Can retrieve the currently selected draw/event context */
	selectionContext: boolean
	/** Can retrieve detailed event information */
	eventDetails: boolean
	/** Can retrieve pipeline state for a given event */
	pipelineState: boolean
	/** Can retrieve shader metadata (stage, entry point, reflection) */
	shaderInfo: boolean
	/** Can retrieve a stable shader identity and source code */
	shaderSource: boolean
	/** Can retrieve mesh/geometry data */
	meshData: boolean
	/** Can retrieve resource (buffer/texture) details */
	resourceDetail: boolean
	/** Can retrieve resource lifecycle/history across events */
	resourceHistory: boolean
	/** Can retrieve raw texture data */
	textureData: boolean
	/** Can retrieve raw buffer data */
	bufferData: boolean
	/** Can retrieve pass graph / render pass structure */
	passGraph: boolean
	/** Can map capture objects back to project source code */
	projectMapping: boolean
	/** Can compare two captures or events for regression analysis */
	captureDiff: boolean
	/** Can produce field-level pipeline differences */
	pipelineDiff: boolean
	/** Can enumerate draw calls and analyze a hot event */
	eventDiagnostics: boolean
}

/**
 * Creates a capabilities object with all fields set to false.
 * Useful as a base for partial capability declarations.
 */
export function emptyCapabilities(): GraphicsProviderCapabilities {
	return {
		frameSummary: false,
		launchTarget: false,
		liveTarget: false,
		captureTrigger: false,
		capturePolling: false,
		selectionContext: false,
		eventDetails: false,
		pipelineState: false,
		shaderInfo: false,
		shaderSource: false,
		meshData: false,
		resourceDetail: false,
		resourceHistory: false,
		textureData: false,
		bufferData: false,
		passGraph: false,
		projectMapping: false,
		captureDiff: false,
		pipelineDiff: false,
		eventDiagnostics: false,
	}
}

/**
 * Checks whether a provider's capabilities satisfy all required capabilities.
 * Returns an object with `satisfied` boolean and `missing` list.
 */
export function checkCapabilities(
	available: GraphicsProviderCapabilities,
	required: Partial<GraphicsProviderCapabilities>,
): { satisfied: boolean; missing: string[] } {
	const missing: string[] = []
	const availableKeys = Object.keys(required) as Array<keyof GraphicsProviderCapabilities>
	for (const key of availableKeys) {
		if (required[key] && !available[key]) {
			missing.push(key)
		}
	}
	return { satisfied: missing.length === 0, missing }
}

// ─── Provider Status ─────────────────────────────────────────────────────────

/**
 * Current availability status of a graphics provider.
 */
export type GraphicsProviderStatus =
	| "available" // Provider is online and ready
	| "unavailable" // Provider is not installed or not running
	| "no-capture" // Provider is running but no capture is open
	| "error" // Provider encountered an error

/**
 * Detailed status information for a provider.
 */
export interface GraphicsProviderStatusInfo {
	status: GraphicsProviderStatus
	message?: string
	providerId: GraphicsProviderId
	providerName: string
}

// ─── Result Types ────────────────────────────────────────────────────────────

export interface LaunchTargetResult {
	success: boolean
	targetId?: string
	error?: string
}

export interface LiveTargetResult {
	success: boolean
	targetId?: string
	ready?: boolean
	error?: string
}

export interface CaptureTriggerResult {
	success: boolean
	operationId?: string
	error?: string
}

export interface CaptureCompletionResult {
	success: boolean
	completed?: boolean
	capturePath?: string
	error?: string
}

/**
 * Result from opening the current capture.
 */
export interface OpenCaptureResult {
	success: boolean
	capturePath?: string
	api?: string // e.g. "D3D12", "Vulkan", "OpenGL"
	frameCount?: number
	error?: string
}

/**
 * Result from retrieving frame summary.
 */
export interface FrameSummaryResult {
	success: boolean
	passes?: PassSummary[]
	totalDurationMs?: number
	hotEvents?: HotEventSummary[]
	error?: string
}

/**
 * Summary of a single render pass.
 */
export interface PassSummary {
	name: string
	eventIdRange: [number, number]
	durationMs?: number
	drawCount?: number
}

/**
 * Summary of a hot (expensive) event.
 */
export interface HotEventSummary {
	eventId: number
	name: string
	durationMs: number
	passName?: string
}

/**
 * Result from retrieving the current selection context.
 */
export interface SelectionContextResult {
	success: boolean
	eventId?: number
	eventName?: string
	passName?: string
	drawType?: string
	error?: string
}

/**
 * Result from retrieving detailed event information.
 */
export interface EventDetailsResult {
	success: boolean
	eventId?: number
	name?: string
	durationMs?: number
	drawCallCount?: number
	primitiveCount?: number
	shaderStages?: string[]
	error?: string
}

/**
 * Result from retrieving pipeline state.
 */
export interface PipelineStateResult {
	success: boolean
	eventId?: number
	renderTargets?: ResourceBinding[]
	depthStencil?: ResourceBinding
	vertexBuffers?: ResourceBinding[]
	samplers?: ResourceBinding[]
	constantBuffers?: ResourceBinding[]
	error?: string
}

/**
 * A single resource binding in the pipeline state.
 */
export interface ResourceBinding {
	slot: number | string
	name?: string
	type?: string
	format?: string
	dimensions?: string
}

/**
 * Request parameters for shader info retrieval.
 */
export interface ShaderInfoRequest {
	eventId: string | number
	stage?: string // e.g. "vertex", "pixel", "compute"
}

/**
 * Result from retrieving shader information.
 */
export interface ShaderInfoResult {
	success: boolean
	eventId?: number
	stage?: string
	entryPoint?: string
	language?: string // e.g. "HLSL", "GLSL", "SPIR-V"
	shaderId?: string
	debugName?: string
	instructionCount?: number
	inputs?: ShaderVariable[]
	outputs?: ShaderVariable[]
	constantBuffers?: string[]
	error?: string
}

export interface ShaderSourceRequest extends ShaderInfoRequest {
	shaderId?: string
}

export interface ShaderSourceResult {
	success: boolean
	eventId?: number
	stage?: string
	shaderId?: string
	entryPoint?: string
	language?: string
	source?: string
	filePath?: string
	debugName?: string
	error?: string
}

export interface ResourceHistoryRequest {
	resourceId: string
	eventId?: number
}

export interface ResourceHistoryEntry {
	eventId: number
	action: "create" | "read" | "write" | "bind" | "destroy" | string
	stage?: string
	binding?: string | number
	description?: string
}

export interface ResourceHistoryResult {
	success: boolean
	resourceId?: string
	name?: string
	format?: string
	dimensions?: string
	history?: ResourceHistoryEntry[]
	error?: string
}

export interface PipelineDiffRequest {
	eventIdA: string | number
	eventIdB: string | number
}

export interface PipelineDiffEntry {
	path: string
	before?: unknown
	after?: unknown
	category?: "binding" | "shader" | "resource" | "configuration" | string
}

export interface PipelineDiffResult {
	success: boolean
	eventIdA?: number
	eventIdB?: number
	differences?: PipelineDiffEntry[]
	error?: string
}

/**
 * A shader input/output variable.
 */
export interface ShaderVariable {
	name: string
	type: string
	semantic?: string
}

/**
 * Request parameters for project implementation mapping.
 */
export interface ProjectMappingRequest {
	/** The type of object to map */
	kind: "shader" | "pass" | "draw" | "resource"
	/** Identifier or name of the object */
	identifier: string
	/** Optional event ID for context */
	eventId?: number
}

/**
 * Result from project implementation mapping.
 */
export interface ProjectMappingResult {
	success: boolean
	candidates?: ProjectMappingCandidate[]
	error?: string
}

/**
 * A candidate source code location for a capture object.
 */
export interface ProjectMappingCandidate {
	filePath: string
	line?: number
	functionName?: string
	confidence: "high" | "medium" | "low"
	description?: string
}

// ─── Graphics Intent ─────────────────────────────────────────────────────────

/**
 * Classification of user intent for graphics-related queries.
 * Used by GraphicsIntentRouter to select the appropriate workflow.
 */
export type GraphicsIntent =
	| "frame_summary" // "分析当前帧", "帧概览"
	| "frame_performance" // "为什么这帧慢", "帧性能"
	| "selected_draw_explain" // "解释当前 draw", "这个 draw"
	| "shader_analysis" // "shader 分析", "shader 为什么慢"
	| "pipeline_analysis" // "pipeline 分析", "pipeline state"
	| "resource_trace" // "资源追踪", "这个纹理从哪来"
	| "project_mapping" // "对应哪段代码", "owner 在哪"
	| "regression_compare" // "对比", "回归分析"
	| "launch_and_capture" // 启动目标并采集 Capture
	| "recapture_validation" // 重新采集并验证修复
	| "graphics_playbook" // "黑屏排查", "GPU 慢排查"

// ─── Graphics Playbook ───────────────────────────────────────────────────────

/**
 * Identifier for built-in graphics debug playbooks.
 */
export type GraphicsPlaybookId = "black_screen" | "gpu_slow" | "heavy_shader" | "shadow_issue"

// ─── Workflow Types ──────────────────────────────────────────────────────────

/**
 * Request to execute a graphics workflow.
 */
export interface GraphicsWorkflowRequest {
	intent: GraphicsIntent
	userMessage: string
	/** Optional playbook ID when intent is "graphics_playbook" */
	playbookId?: GraphicsPlaybookId
	/** Optional explicit event ID */
	eventId?: number
	/** Optional shader stage for shader-focused diagnostics. */
	shaderStage?: string
	/** Optional resource identifier for resource tracing. */
	resourceId?: string
	/** Optional event pair for comparison diagnostics. */
	eventIdA?: number
	eventIdB?: number
	/** Explicit project mapping target from Runtime UI. */
	mappingKind?: ProjectMappingRequest["kind"]
	mappingIdentifier?: string
	/** Launch Profile used by launch/capture workflows. */
	graphicsProfileId?: string
	/** Investigation session used to persist intermediate and final evidence. */
	graphicsSessionId?: string
	/** Provider-side capture operation associated with this request. */
	graphicsOperationId?: string
	/** Baseline and candidate artifact identifiers for validation. */
	baselineCaptureId?: string
	candidateCaptureId?: string
	/** Total operation timeout in milliseconds. */
	timeoutMs?: number
	/** Optional cancellation signal for host-side workflow execution. */
	signal?: AbortSignal
	/** Correlates the workflow with a webview request. */
	requestId?: string
}

/**
 * Structured result from a graphics workflow execution.
 */
export interface GraphicsWorkflowResult {
	/** High-level summary / conclusion */
	summary: string
	/** Intent that produced this result. */
	intent?: GraphicsIntent
	/** Provider selected after capability preflight. */
	providerId?: string
	/** Evidence items supporting the conclusion */
	evidence: EvidenceItem[]
	/** Suspected bottleneck or risk areas */
	suspectedIssues: SuspectedIssue[]
	/** Recommended next steps */
	suggestions: string[]
	/** Project code mapping candidates, if available */
	projectMapping?: ProjectMappingCandidate[]
	/** Mapping target used to produce projectMapping. */
	mappingTarget?: Pick<ProjectMappingRequest, "kind" | "identifier" | "eventId">
	/** Raw data from provider calls, for debugging */
	rawData?: Record<string, unknown>
	/** Whether the workflow completed successfully */
	success: boolean
	/** Error message if workflow failed */
	error?: string
}

/**
 * A single piece of evidence in a workflow result.
 */
export interface EvidenceItem {
	/** Source of the evidence (e.g. "frameSummary", "pipelineState") */
	source: string
	/** Human-readable description */
	description: string
	/** Raw data value, if applicable */
	value?: unknown
}

/**
 * A suspected issue or bottleneck identified during analysis.
 */
export interface SuspectedIssue {
	/** Category of the issue */
	category: "performance" | "correctness" | "resource" | "configuration"
	/** Human-readable description */
	description: string
	/** Confidence level */
	confidence: "high" | "medium" | "low"
}

// ─── Launch, Validation, and Investigation Types ─────────────────────────────

export type GraphicsLaunchPlatform = "windows" | "android"
export type GraphicsCaptureTrigger = "immediate" | "frame" | "delay"

export interface GraphicsCaptureTriggerPolicy {
	mode: GraphicsCaptureTrigger
	frameNumber?: number
	delayMs?: number
}

export interface GraphicsLaunchProfile {
	version: 1
	id: string
	name: string
	platform: GraphicsLaunchPlatform
	executable?: string
	packageName?: string
	activityName?: string
	workingDirectory?: string
	commandLine?: string
	environmentVariables?: Record<string, string>
	captureTrigger: GraphicsCaptureTriggerPolicy
	startupWaitMs: number
	expectedGraphicsApi?: string
	performanceBudgetMs?: number
	buildCommand?: string
	updatedAt: string
}

export interface GraphicsReproducibilityMetadata {
	profileId?: string
	gitCommit?: string
	workspaceDirty?: boolean
	resolution?: { width: number; height: number }
	qualityLevel?: string
	scene?: string
	camera?: string
	graphicsApi?: string
	gpu?: string
	driver?: string
	performanceBudgetMs?: number
	captureTrigger?: GraphicsCaptureTriggerPolicy
	capturedAt: string
}

export interface GraphicsCaptureArtifact {
	id: string
	capturePath?: string
	providerId: string
	frameSummary?: FrameSummaryResult
	metadata: GraphicsReproducibilityMetadata
	createdAt: string
	cacheRevision: number
}

export type GraphicsValidationStatus = "passed" | "failed" | "insufficient-data" | "incomparable"

export interface GraphicsValidationReport {
	status: GraphicsValidationStatus
	confidence: "high" | "medium" | "low"
	summary: string
	environmentMatches: boolean
	mismatches: string[]
	metrics: Array<{
		name: string
		before?: number
		after?: number
		deltaPercent?: number
		improved?: boolean
		withinBudget?: boolean
	}>
	evidence: EvidenceItem[]
	generatedAt: string
}

export type GraphicsInvestigationSessionStatus = "idle" | "running" | "completed" | "failed" | "cancelled"

export interface GraphicsInvestigationSession {
	version: 1
	id: string
	status: GraphicsInvestigationSessionStatus
	profileId?: string
	baselineCapture?: GraphicsCaptureArtifact
	candidateCapture?: GraphicsCaptureArtifact
	evidence: EvidenceItem[]
	validation?: GraphicsValidationReport
	environment?: GraphicsReproducibilityMetadata
	createdAt: string
	updatedAt: string
	revision: number
}

export interface GraphicsOperationContext {
	requestId?: string
	sessionId?: string
	timeoutMs?: number
	signal?: AbortSignal
}

export type GraphicsOperationErrorCode =
	| "PROFILE_INVALID"
	| "PROVIDER_UNAVAILABLE"
	| "TARGET_LAUNCH_FAILED"
	| "LIVE_TARGET_TIMEOUT"
	| "CAPTURE_TRIGGER_FAILED"
	| "CAPTURE_TIMEOUT"
	| "CAPTURE_LOAD_FAILED"
	| "FRAME_SUMMARY_FAILED"
	| "CANCELLED"
	| "CACHE_STALE"

export interface GraphicsOperationError {
	code: GraphicsOperationErrorCode
	message: string
	recoverable: boolean
	completedStages?: string[]
	recoveryActions?: string[]
}

// ─── UI Action Types ─────────────────────────────────────────────────────────

/**
 * Actions that the frontend can send to the backend for graphics operations.
 */
export type GraphicsUIAction =
	| { type: "runGraphicsWorkflow"; intent: GraphicsIntent; message?: string }
	| { type: "runGraphicsPlaybook"; playbookId: GraphicsPlaybookId }
	| { type: "selectGraphicsProvider"; providerId: string }
	| { type: "analyzeCurrentFrame" }
	| { type: "explainSelectedDraw" }
	| { type: "findOwnerInProject" }

/**
 * Messages sent from backend to frontend with graphics results.
 */
export interface GraphicsResultMessage {
	type: "graphicsResult"
	result: GraphicsWorkflowResult
	providerId: string
	providerName: string
	timestamp: number
}
