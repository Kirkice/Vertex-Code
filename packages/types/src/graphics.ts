/**
 * Graphics Types
 *
 * Type definitions for graphics capture provider abstraction layer.
 * These types define the contract between Vertex's graphics workflow layer
 * and external graphics capture tools (RenderDoc, custom MCPs, etc.).
 *
 * @module graphics
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
	/** Can retrieve the currently selected draw/event context */
	selectionContext: boolean
	/** Can retrieve detailed event information */
	eventDetails: boolean
	/** Can retrieve pipeline state for a given event */
	pipelineState: boolean
	/** Can retrieve shader metadata (stage, entry point, reflection) */
	shaderInfo: boolean
	/** Can retrieve shader source code */
	shaderSource: boolean
	/** Can retrieve mesh/geometry data */
	meshData: boolean
	/** Can retrieve resource (buffer/texture) details */
	resourceDetail: boolean
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
	instructionCount?: number
	inputs?: ShaderVariable[]
	outputs?: ShaderVariable[]
	constantBuffers?: string[]
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
}

/**
 * Structured result from a graphics workflow execution.
 */
export interface GraphicsWorkflowResult {
	/** High-level summary / conclusion */
	summary: string
	/** Evidence items supporting the conclusion */
	evidence: EvidenceItem[]
	/** Suspected bottleneck or risk areas */
	suspectedIssues: SuspectedIssue[]
	/** Recommended next steps */
	suggestions: string[]
	/** Project code mapping candidates, if available */
	projectMapping?: ProjectMappingCandidate[]
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

// ─── Workspace Types ─────────────────────────────────────────────────────────

/** Editable, provider-independent input that starts a graphics feature workflow. */
export interface GraphicsFeatureBrief {
	version: 1
	title: string
	visualGoal: string
	lifecycle: string
	artControls: string
	targetPlatforms: string
	performanceBudget: string
	compatibilityRequirements: string
	acceptanceCriteria: string
	updatedAt?: string
}

/** A source file or directory that supports a detected project-profile fact. */
export interface GraphicsProjectEvidence {
	path: string
	description: string
}

/** Stable categories used by planning and solution-selection workflows. */
export type GraphicsArchitectureCategory = "pipeline" | "pass" | "shader" | "client" | "asset" | "quality"

/** A source-backed architecture fact discovered in the active project. */
export interface GraphicsArchitectureFinding {
	category: GraphicsArchitectureCategory
	path: string
	kind: string
	symbol?: string
	detail: string
}

/** Bounded deep index of graphics configuration and source-code entry points. */
export interface GraphicsArchitectureIndex {
	version: 1
	findings: GraphicsArchitectureFinding[]
	analyzedFileCount: number
	truncated: boolean
}

/** Implementation levels compared by the first-phase graphics solution selector. */
export type GraphicsSolutionLevel =
	| "configuration"
	| "shader"
	| "renderer-pass"
	| "post-process"
	| "render-graph"
	| "compute"
	| "cpu-client"

/** Explainable score for one possible graphics implementation level. */
export interface GraphicsSolutionCandidate {
	level: GraphicsSolutionLevel
	label: string
	score: number
	confidence: "high" | "medium" | "low"
	reasons: string[]
	risks: string[]
	rejectionReasons: string[]
}

/** Deterministic, project-aware recommendation produced before implementation begins. */
export interface GraphicsSolutionRecommendation {
	version: 1
	recommendedLevel: GraphicsSolutionLevel
	summary: string
	candidates: GraphicsSolutionCandidate[]
	assumptions: string[]
	generatedAt: string
}

/** A focused design section in a cross-module graphics feature plan. */
export interface GraphicsFeaturePlanSection {
	summary: string
	details: string[]
}

export type GraphicsFeatureTaskKind =
	| "spike"
	| "prototype"
	| "pipeline"
	| "shader"
	| "client"
	| "asset"
	| "observability"
	| "validation"
	| "delivery"

export type GraphicsFeatureTaskOwner = "graphics" | "client" | "technical-art" | "qa" | "design"

export type GraphicsFeatureTaskStatus = "pending" | "in-progress" | "blocked" | "completed" | "skipped"

/** An independently verifiable unit of implementation work, ordered by dependencies. */
export interface GraphicsFeatureTask {
	id: string
	kind: GraphicsFeatureTaskKind
	title: string
	owner: GraphicsFeatureTaskOwner
	status: GraphicsFeatureTaskStatus
	statusNote?: string
	statusUpdatedAt?: string
	inputs: string[]
	outputs: string[]
	dependsOn: string[]
	completionConditions: string[]
}

export interface GraphicsFeatureRisk {
	id: string
	title: string
	impact: "high" | "medium" | "low"
	mitigation: string
	reviewGate?: string
}

export interface GraphicsFeatureCompatibilityTarget {
	target: string
	strategy: string
	fallback: string
}

export interface GraphicsFeatureAcceptanceCheck {
	id: string
	dimension: "visual" | "functional" | "performance" | "compatibility"
	criterion: string
	evidence: "screenshot" | "automated-test" | "build" | "profiler" | "capture" | "device-test"
}

export type GraphicsFeaturePlanSource = "generated" | "workspace" | "manual"

/** Versioned, deterministic first-phase plan spanning graphics, client, art, and validation work. */
export interface GraphicsFeaturePlan {
	version: 1
	revision: number
	source: GraphicsFeaturePlanSource
	updatedAt: string
	title: string
	briefSummary: string
	openQuestions: string[]
	projectContext: string[]
	decision: {
		recommendedLevel: GraphicsSolutionLevel
		rationale: string[]
		alternatives: Array<{ level: GraphicsSolutionLevel; reasonNotSelected: string }>
	}
	pipelineDesign: GraphicsFeaturePlanSection
	shaderDesign: GraphicsFeaturePlanSection
	clientDesign: GraphicsFeaturePlanSection
	assetContract: {
		requirements: string[]
		validationRules: string[]
	}
	performanceBudget: GraphicsFeaturePlanSection
	compatibility: GraphicsFeatureCompatibilityTarget[]
	risks: GraphicsFeatureRisk[]
	tasks: GraphicsFeatureTask[]
	acceptancePlan: GraphicsFeatureAcceptanceCheck[]
	generatedAt: string
}

/** Source-derived graphics architecture profile for the active workspace. */
export interface GraphicsProjectProfile {
	version: 1
	workspaceName: string
	engine: "unity" | "unreal" | "custom" | "unknown"
	engineVersion?: string
	renderPipelines: string[]
	graphicsApis: string[]
	targetPlatforms: string[]
	shaderLanguages: string[]
	architectureSignals: string[]
	architectureIndex: GraphicsArchitectureIndex
	evidence: GraphicsProjectEvidence[]
	warnings: string[]
	scannedAt: string
}

/** Request to update one task without replacing the rest of the persisted plan. */
export interface GraphicsFeatureTaskStatusUpdate {
	taskId: string
	status: GraphicsFeatureTaskStatus
	statusNote?: string
	expectedRevision?: number
}

/** Graphics data persisted in VS Code's webview state for reload-safe draft recovery. */
export interface GraphicsWorkspacePersistedState {
	featureBrief?: GraphicsFeatureBrief
	featurePlan?: GraphicsFeaturePlan
}

/** Shared envelope used to merge graphics drafts without replacing unrelated webview state. */
export interface GraphicsWebviewPersistedState {
	graphicsWorkspace?: GraphicsWorkspacePersistedState
	[key: string]: unknown
}

/** Provider-independent sections exposed by the Graphics Workspace. */
export type GraphicsWorkspaceSection = "feature" | "assets" | "runtime"

/** Availability of an optional workspace capability. */
export type GraphicsCapabilityAvailability = "available" | "unavailable" | "degraded" | "unknown"

/** A capability card rendered by the workspace without binding to a specific tool. */
export interface GraphicsWorkspaceCapability {
	id: "feature-planning" | "source-analysis" | "asset-validation" | "runtime-capture"
	label: string
	description: string
	availability: GraphicsCapabilityAvailability
	providerId?: GraphicsProviderId
	providerName?: string
	reason?: string
}

/** Payload returned for the lazily requested runtime provider status. */
export interface GraphicsProviderStatusPayload {
	providers: GraphicsProviderStatusInfo[]
	selectedProviderId?: GraphicsProviderId
	capabilitiesByProviderId: Record<GraphicsProviderId, GraphicsProviderCapabilities | null>
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
