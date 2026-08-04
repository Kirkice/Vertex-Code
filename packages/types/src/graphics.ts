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
export type GraphicsProviderKind = "mcp" | "extension-bridge" | "hybrid";

/**
 * Unique identifier for a graphics provider instance.
 */
export type GraphicsProviderId = string;

// ─── Provider Capabilities ───────────────────────────────────────────────────

/**
 * Declares which capabilities a provider supports.
 * Not all providers implement every capability — workflows should check
 * required capabilities before execution via preflight checks.
 */
export interface GraphicsProviderCapabilities {
  /** Can retrieve frame-level summary (pass list, timings overview) */
  frameSummary: boolean;
  /** Can launch a configured Windows or Android target. */
  launchTarget?: boolean;
  /** Can observe a launched target becoming available for capture. */
  liveTarget?: boolean;
  /** Can trigger a capture according to a launch profile policy. */
  captureTrigger?: boolean;
  /** Can poll for capture completion. */
  capturePolling?: boolean;
  /** Can retrieve the currently selected draw/event context */
  selectionContext: boolean;
  /** Can retrieve detailed event information */
  eventDetails: boolean;
  /** Can retrieve pipeline state for a given event */
  pipelineState: boolean;
  /** Can retrieve shader metadata (stage, entry point, reflection) */
  shaderInfo: boolean;
  /** Can retrieve a stable shader identity and source code */
  shaderSource: boolean;
  /** Can retrieve mesh/geometry data */
  meshData: boolean;
  /** Can retrieve resource (buffer/texture) details */
  resourceDetail: boolean;
  /** Can retrieve resource lifecycle/history across events */
  resourceHistory: boolean;
  /** Can retrieve raw texture data */
  textureData: boolean;
  /** Can retrieve raw buffer data */
  bufferData: boolean;
  /** Can retrieve pass graph / render pass structure */
  passGraph: boolean;
  /** Can map capture objects back to project source code */
  projectMapping: boolean;
  /** Can compare two captures or events for regression analysis */
  captureDiff: boolean;
  /** Can produce field-level pipeline differences */
  pipelineDiff: boolean;
  /** Can enumerate draw calls and analyze a hot event */
  eventDiagnostics: boolean;
}

// ─── Provider Status ─────────────────────────────────────────────────────────

/**
 * Current availability status of a graphics provider.
 */
export type GraphicsProviderStatus =
  | "available" // Provider is online and ready
  | "unavailable" // Provider is not installed or not running
  | "no-capture" // Provider is running but no capture is open
  | "error"; // Provider encountered an error

/**
 * Detailed status information for a provider.
 */
export interface GraphicsProviderStatusInfo {
  status: GraphicsProviderStatus;
  message?: string;
  providerId: GraphicsProviderId;
  providerName: string;
}

// ─── Result Types ────────────────────────────────────────────────────────────

export interface LaunchTargetResult {
  success: boolean;
  targetId?: string;
  error?: string;
}

export interface LiveTargetResult {
  success: boolean;
  targetId?: string;
  ready?: boolean;
  error?: string;
}

export interface CaptureTriggerResult {
  success: boolean;
  operationId?: string;
  error?: string;
}

export interface CaptureCompletionResult {
  success: boolean;
  completed?: boolean;
  capturePath?: string;
  error?: string;
}

export interface OpenCaptureResult {
  success: boolean;
  capturePath?: string;
  api?: string; // e.g. "D3D12", "Vulkan", "OpenGL"
  frameCount?: number;
  error?: string;
}

/**
 * Result from retrieving frame summary.
 */
export interface FrameSummaryResult {
  success: boolean;
  passes?: PassSummary[];
  totalDurationMs?: number;
  hotEvents?: HotEventSummary[];
  error?: string;
}

/**
 * Summary of a single render pass.
 */
export interface PassSummary {
  name: string;
  eventIdRange: [number, number];
  durationMs?: number;
  drawCount?: number;
}

/**
 * Summary of a hot (expensive) event.
 */
export interface HotEventSummary {
  eventId: number;
  name: string;
  durationMs: number;
  passName?: string;
}

/**
 * Result from retrieving the current selection context.
 */
export interface SelectionContextResult {
  success: boolean;
  eventId?: number;
  eventName?: string;
  passName?: string;
  drawType?: string;
  error?: string;
}

/**
 * Result from retrieving detailed event information.
 */
export interface EventDetailsResult {
  success: boolean;
  eventId?: number;
  name?: string;
  durationMs?: number;
  drawCallCount?: number;
  primitiveCount?: number;
  shaderStages?: string[];
  error?: string;
}

/**
 * Result from retrieving pipeline state.
 */
export interface PipelineStateResult {
  success: boolean;
  eventId?: number;
  renderTargets?: ResourceBinding[];
  depthStencil?: ResourceBinding;
  vertexBuffers?: ResourceBinding[];
  samplers?: ResourceBinding[];
  constantBuffers?: ResourceBinding[];
  error?: string;
}

/**
 * A single resource binding in the pipeline state.
 */
export interface ResourceBinding {
  slot: number | string;
  name?: string;
  type?: string;
  format?: string;
  dimensions?: string;
}

/**
 * Request parameters for shader info retrieval.
 */
export interface ShaderInfoRequest {
  eventId: string | number;
  stage?: string; // e.g. "vertex", "pixel", "compute"
}

/**
 * Result from retrieving shader information.
 */
export interface ShaderInfoResult {
  success: boolean;
  eventId?: number;
  stage?: string;
  entryPoint?: string;
  language?: string; // e.g. "HLSL", "GLSL", "SPIR-V"
  shaderId?: string;
  debugName?: string;
  instructionCount?: number;
  inputs?: ShaderVariable[];
  outputs?: ShaderVariable[];
  constantBuffers?: string[];
  error?: string;
}

export interface ShaderSourceRequest extends ShaderInfoRequest {
  shaderId?: string;
}

export interface ShaderSourceResult {
  success: boolean;
  eventId?: number;
  stage?: string;
  shaderId?: string;
  entryPoint?: string;
  language?: string;
  source?: string;
  filePath?: string;
  debugName?: string;
  error?: string;
}

export interface ResourceHistoryRequest {
  resourceId: string;
  eventId?: number;
}

export interface ResourceHistoryEntry {
  eventId: number;
  action: "create" | "read" | "write" | "bind" | "destroy" | string;
  stage?: string;
  binding?: string | number;
  description?: string;
}

export interface ResourceHistoryResult {
  success: boolean;
  resourceId?: string;
  name?: string;
  format?: string;
  dimensions?: string;
  history?: ResourceHistoryEntry[];
  error?: string;
}

export interface PipelineDiffRequest {
  eventIdA: string | number;
  eventIdB: string | number;
}

export interface PipelineDiffEntry {
  path: string;
  before?: unknown;
  after?: unknown;
  category?: "binding" | "shader" | "resource" | "configuration" | string;
}

export interface PipelineDiffResult {
  success: boolean;
  eventIdA?: number;
  eventIdB?: number;
  differences?: PipelineDiffEntry[];
  error?: string;
}

/**
 * A shader input/output variable.
 */
export interface ShaderVariable {
  name: string;
  type: string;
  semantic?: string;
}

/**
 * Request parameters for project implementation mapping.
 */
export interface ProjectMappingRequest {
  /** The type of object to map */
  kind: "shader" | "pass" | "draw" | "resource";
  /** Identifier or name of the object */
  identifier: string;
  /** Optional event ID for context */
  eventId?: number;
}

/**
 * Result from project implementation mapping.
 */
export interface ProjectMappingResult {
  success: boolean;
  candidates?: ProjectMappingCandidate[];
  error?: string;
}

/**
 * A candidate source code location for a capture object.
 */
export interface ProjectMappingCandidate {
  filePath: string;
  line?: number;
  functionName?: string;
  confidence: "high" | "medium" | "low";
  description?: string;
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
  | "graphics_playbook"; // "黑屏排查", "GPU 慢排查"

// ─── Graphics Playbook ───────────────────────────────────────────────────────

/**
 * Identifier for built-in graphics debug playbooks.
 */
export type GraphicsPlaybookId =
  | "black_screen"
  | "gpu_slow"
  | "heavy_shader"
  | "shadow_issue";

// ─── Workflow Types ──────────────────────────────────────────────────────────

/**
 * Request to execute a graphics workflow.
 */
export interface GraphicsWorkflowRequest {
  intent: GraphicsIntent;
  userMessage: string;
  /** Optional playbook ID when intent is "graphics_playbook" */
  playbookId?: GraphicsPlaybookId;
  /** Optional explicit event ID */
  eventId?: number;
  /** Optional shader stage for shader-focused diagnostics. */
  shaderStage?: string;
  /** Optional resource identifier for resource tracing. */
  resourceId?: string;
  /** Optional event pair for comparison diagnostics. */
  eventIdA?: number;
  eventIdB?: number;
  /** Explicit project mapping target from Runtime UI. */
  mappingKind?: ProjectMappingRequest["kind"];
  mappingIdentifier?: string;
  /** Launch Profile used by launch/capture workflows. */
  graphicsProfileId?: string;
  /** Investigation session used to persist intermediate and final evidence. */
  graphicsSessionId?: string;
  /** Provider-side capture operation associated with this request. */
  graphicsOperationId?: string;
  /** Baseline and candidate artifact identifiers for validation. */
  baselineCaptureId?: string;
  candidateCaptureId?: string;
  /** Total operation timeout in milliseconds. */
  timeoutMs?: number;
  /** Optional cancellation signal for host-side workflow execution. */
  signal?: AbortSignal;
  /** Correlates the workflow with a webview request. */
  requestId?: string;
}

/**
 * Structured result from a graphics workflow execution.
 */
export interface GraphicsWorkflowResult {
  /** High-level summary / conclusion */
  summary: string;
  /** Intent that produced this result. */
  intent?: GraphicsIntent;
  /** Provider selected after capability preflight. */
  providerId?: string;
  /** Evidence items supporting the conclusion */
  evidence: EvidenceItem[];
  /** Suspected bottleneck or risk areas */
  suspectedIssues: SuspectedIssue[];
  /** Recommended next steps */
  suggestions: string[];
  /** Project code mapping candidates, if available */
  projectMapping?: ProjectMappingCandidate[];
  /** Mapping target used to produce projectMapping. */
  mappingTarget?: Pick<ProjectMappingRequest, "kind" | "identifier" | "eventId">;
  /** Raw data from provider calls, for debugging */
  rawData?: Record<string, unknown>;
  /** Whether the workflow completed successfully */
  success: boolean;
  /** Error message if workflow failed */
  error?: string;
}

/**
 * A single piece of evidence in a workflow result.
 */
export interface EvidenceItem {
  /** Source of the evidence (e.g. "frameSummary", "pipelineState") */
  source: string;
  /** Human-readable description */
  description: string;
  /** Raw data value, if applicable */
  value?: unknown;
}

/**
 * A suspected issue or bottleneck identified during analysis.
 */
export interface SuspectedIssue {
  /** Category of the issue */
  category: "performance" | "correctness" | "resource" | "configuration";
  /** Human-readable description */
  description: string;
  /** Confidence level */
  confidence: "high" | "medium" | "low";
}

// ─── Workspace Types ─────────────────────────────────────────────────────────

/** Editable, provider-independent input that starts a graphics feature workflow. */
export interface GraphicsFeatureBrief {
  version: 1;
  title: string;
  visualGoal: string;
  lifecycle: string;
  artControls: string;
  targetPlatforms: string;
  performanceBudget: string;
  compatibilityRequirements: string;
  acceptanceCriteria: string;
  updatedAt?: string;
}

/** A source file or directory that supports a detected project-profile fact. */
export interface GraphicsProjectEvidence {
  path: string;
  description: string;
}

/** Stable categories used by planning and solution-selection workflows. */
export type GraphicsArchitectureCategory =
  | "pipeline"
  | "pass"
  | "shader"
  | "client"
  | "asset"
  | "quality";

/** A source-backed architecture fact discovered in the active project. */
export interface GraphicsArchitectureFinding {
  category: GraphicsArchitectureCategory;
  path: string;
  kind: string;
  symbol?: string;
  detail: string;
}

/** A stable node in the project graphics architecture relationship graph. */
export interface GraphicsArchitectureGraphNode {
  id: string;
  kind: "file" | "asset" | "symbol" | "guid";
  label: string;
  path?: string;
  guid?: string;
}

/** A directed reference such as pipeline asset -> renderer data or shader -> include. */
export interface GraphicsArchitectureGraphEdge {
  from: string;
  to: string;
  kind: "references" | "contains" | "includes" | "implements";
  detail?: string;
}

/** A reusable-feature candidate ranked by architecture evidence overlap. */
export interface GraphicsSimilarFeature {
  id: string;
  label: string;
  score: number;
  evidence: string[];
}

/** Bounded deep index of graphics configuration and source-code entry points. */
export interface GraphicsArchitectureIndex {
  version: 1;
  findings: GraphicsArchitectureFinding[];
  analyzedFileCount: number;
  truncated: boolean;
  /** Optional graph fields keep persisted version-one profiles backward compatible. */
  graph?: {
    nodes: GraphicsArchitectureGraphNode[];
    edges: GraphicsArchitectureGraphEdge[];
  };
  similarFeatures?: GraphicsSimilarFeature[];
}

/** Implementation levels compared by the first-phase graphics solution selector. */
export type GraphicsSolutionLevel =
  | "configuration"
  | "shader"
  | "renderer-pass"
  | "post-process"
  | "render-graph"
  | "compute"
  | "cpu-client";

/** Optional capability and budget inputs used to gate a solution candidate. */
export interface GraphicsSolutionConstraints {
  availableCapabilities?: string[];
  maxCost?: number;
  costUnit?: string;
}

/** Explainable score for one possible graphics implementation level. */
export interface GraphicsSolutionCandidate {
  level: GraphicsSolutionLevel;
  label: string;
  score: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  risks: string[];
  rejectionReasons: string[];
  requiredCapabilities?: string[];
  resourceNeeds?: string[];
  estimatedCost?: number;
}

/** A serializable rule that can be supplied by a market Knowledge/Skill package. */
export interface GraphicsSolutionRulePackage {
  id: string;
  label: string;
  rules: Array<{
    levels: GraphicsSolutionLevel[];
    pattern: string;
    score: number;
    reason: string;
    risk?: string;
    requiredCapabilities?: string[];
    resourceNeeds?: string[];
    estimatedCost?: number;
  }>;
}

/** Optional human decision that takes precedence over automatic ranking. */
export interface GraphicsSolutionOverride {
  level: GraphicsSolutionLevel;
  reason: string;
  decidedBy?: string;
}

/** Deterministic, project-aware recommendation produced before implementation begins. */
export interface GraphicsSolutionRecommendation {
  version: 1;
  recommendedLevel: GraphicsSolutionLevel;
  summary: string;
  candidates: GraphicsSolutionCandidate[];
  assumptions: string[];
  constraints?: GraphicsSolutionConstraints;
  /** Records whether a package or human override influenced this recommendation. */
  decisionHistory?: Array<{
    source: string;
    decision: string;
    reason: string;
    at: string;
  }>;
  generatedAt: string;
}

/** A conflict produced by a three-way shared-plan merge. */
export interface GraphicsFeaturePlanMergeConflict {
  path: string;
  baseValue: unknown;
  localValue: unknown;
  currentValue: unknown;
}

/** A focused design section in a cross-module graphics feature plan. */
export interface GraphicsFeaturePlanSection {
  summary: string;
  details: string[];
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
  | "delivery";

export type GraphicsFeatureTaskOwner =
  | "graphics"
  | "client"
  | "technical-art"
  | "qa"
  | "design";

export type GraphicsFeatureTaskStatus =
  | "pending"
  | "in-progress"
  | "blocked"
  | "completed"
  | "skipped";

/** An independently verifiable unit of implementation work, ordered by dependencies. */
export interface GraphicsFeatureTask {
  id: string;
  kind: GraphicsFeatureTaskKind;
  title: string;
  owner: GraphicsFeatureTaskOwner;
  status: GraphicsFeatureTaskStatus;
  statusNote?: string;
  statusUpdatedAt?: string;
  inputs: string[];
  outputs: string[];
  dependsOn: string[];
  completionConditions: string[];
}

export interface GraphicsFeatureRisk {
  id: string;
  title: string;
  impact: "high" | "medium" | "low";
  mitigation: string;
  reviewGate?: string;
}

export interface GraphicsFeatureCompatibilityTarget {
  target: string;
  strategy: string;
  fallback: string;
}

export interface GraphicsFeatureAcceptanceCheck {
  id: string;
  dimension: "visual" | "functional" | "performance" | "compatibility";
  criterion: string;
  evidence:
    | "screenshot"
    | "automated-test"
    | "build"
    | "profiler"
    | "capture"
    | "device-test";
}

export type GraphicsFeaturePlanSource = "generated" | "workspace" | "manual";

/** A single observable event emitted while a feature task is executing. */
export interface GraphicsFeatureTaskExecutionLog {
  timestamp: string;
  level: "info" | "warning" | "error";
  message: string;
}

/**
 * A bounded execution record for a task delegated to an Agent or human role.
 *
 * Optional fields deliberately preserve compatibility with plans written before
 * execution history was introduced, while allowing retries to remain traceable.
 */
export interface GraphicsFeatureTaskExecution {
  /** Stable identity for one attempt; retries receive a new execution ID. */
  executionId?: string;
  taskId: string;
  executor: "agent" | "human";
  role: GraphicsFeatureTaskOwner;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  retryCount?: number;
  startedAt?: string;
  finishedAt?: string;
  updatedAt?: string;
  output?: string[];
  error?: string;
  logs?: GraphicsFeatureTaskExecutionLog[];
  cancellationReason?: string;
  /** Revision/fingerprint used to reject stale asynchronous completions. */
  planRevision?: number;
  planFingerprint?: string;
  /** ID of the underlying Agent Task when executor is `agent`. */
  agentTaskId?: string;
}

/** A versioned artifact envelope keeps independently recoverable plan sections tied to one revision. */
export interface GraphicsFeatureArtifactEnvelope<T> {
  version: 1;
  kind: GraphicsFeatureArtifactKind;
  featurePlanRevision: number;
  generatedAt: string;
  value: T;
}

export type GraphicsFeatureArtifactKind =
  | "architecture-decision"
  | "asset-contract"
  | "performance-budget"
  | "compatibility-matrix"
  | "verification-report";

export type GraphicsArchitectureDecisionArtifact = GraphicsFeaturePlan["decision"];
export type GraphicsAssetContractArtifact = GraphicsFeaturePlan["assetContract"];
export type GraphicsPerformanceBudgetArtifact = GraphicsFeaturePlan["performanceBudget"];
export type GraphicsCompatibilityMatrixArtifact = GraphicsFeaturePlan["compatibility"];

/** Persisted verification evidence remains independently editable without changing the plan schema. */
export interface GraphicsVerificationReportArtifact {
  checks: GraphicsFeatureAcceptanceCheck[];
  status: "pending" | "passed" | "failed";
  summary: string;
}

export interface GraphicsFeaturePlanArtifacts {
  architectureDecision: GraphicsFeatureArtifactEnvelope<GraphicsArchitectureDecisionArtifact>;
  assetContract: GraphicsFeatureArtifactEnvelope<GraphicsAssetContractArtifact>;
  performanceBudget: GraphicsFeatureArtifactEnvelope<GraphicsPerformanceBudgetArtifact>;
  compatibilityMatrix: GraphicsFeatureArtifactEnvelope<GraphicsCompatibilityMatrixArtifact>;
  verificationReport: GraphicsFeatureArtifactEnvelope<GraphicsVerificationReportArtifact>;
}

/** Versioned, deterministic first-phase plan spanning graphics, client, art, and validation work. */
export interface GraphicsFeaturePlan {
  version: 1;
  revision: number;
  source: GraphicsFeaturePlanSource;
  updatedAt: string;
  title: string;
  briefSummary: string;
  openQuestions: string[];
  projectContext: string[];
  decision: {
    recommendedLevel: GraphicsSolutionLevel;
    rationale: string[];
    alternatives: Array<{
      level: GraphicsSolutionLevel;
      reasonNotSelected: string;
    }>;
  };
  pipelineDesign: GraphicsFeaturePlanSection;
  shaderDesign: GraphicsFeaturePlanSection;
  clientDesign: GraphicsFeaturePlanSection;
  assetContract: {
    requirements: string[];
    validationRules: string[];
  };
  performanceBudget: GraphicsFeaturePlanSection;
  compatibility: GraphicsFeatureCompatibilityTarget[];
  risks: GraphicsFeatureRisk[];
  tasks: GraphicsFeatureTask[];
  /** Optional execution state remains backward compatible with existing plans. */
  executions?: GraphicsFeatureTaskExecution[];
  acceptancePlan: GraphicsFeatureAcceptanceCheck[];
  generatedAt: string;
}

/** Source-derived graphics architecture profile for the active workspace. */
export interface GraphicsProjectProfile {
  version: 1;
  workspaceName: string;
  engine: "unity" | "unreal" | "custom" | "unknown";
  engineVersion?: string;
  renderPipelines: string[];
  graphicsApis: string[];
  targetPlatforms: string[];
  shaderLanguages: string[];
  architectureSignals: string[];
  architectureIndex: GraphicsArchitectureIndex;
  evidence: GraphicsProjectEvidence[];
  warnings: string[];
  scannedAt: string;
}

/** Request to update one task without replacing the rest of the persisted plan. */
export interface GraphicsFeatureTaskStatusUpdate {
  taskId: string;
  status: GraphicsFeatureTaskStatus;
  statusNote?: string;
  expectedRevision?: number;
}

/** Graphics data persisted in VS Code's webview state for reload-safe draft recovery. */
export interface GraphicsWorkspacePersistedState {
  featureBrief?: GraphicsFeatureBrief;
  featurePlan?: GraphicsFeaturePlan;
}

/** Shared envelope used to merge graphics drafts without replacing unrelated webview state. */
export interface GraphicsWebviewPersistedState {
  graphicsWorkspace?: GraphicsWorkspacePersistedState;
  [key: string]: unknown;
}

/** Provider-independent sections exposed by the Graphics Workspace. */
export type GraphicsWorkspaceSection = "feature" | "assets" | "runtime";

/** Marketplace or runtime source that contributes a graphics capability. */
export type GraphicsCapabilitySourceKind =
  | "knowledge"
  | "skill"
  | "mcp"
  | "provider";

/** Health state reported by a capability source. */
export type GraphicsCapabilityHealth =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "unknown";

/** Installation/runtime scope used when resolving duplicate capability sources. */
export type GraphicsCapabilityScope = "built-in" | "global" | "project";

/** A normalized, source-independent capability declaration. */
export interface GraphicsCapabilityDescriptor {
  id: string;
  label: string;
  description?: string;
  sourceKind: GraphicsCapabilitySourceKind;
  sourceId: string;
  version?: string;
  providedCapabilities: string[];
  requiredCapabilities?: string[];
  dependencies?: string[];
  availability: GraphicsCapabilityAvailability;
  health: GraphicsCapabilityHealth;
  scope?: GraphicsCapabilityScope;
  reason?: string;
  diagnostics?: string[];
}

/** Registry entry retaining registration metadata without changing the descriptor contract. */
export interface GraphicsCapabilityRegistryEntry {
  descriptor: GraphicsCapabilityDescriptor;
  registeredAt: string;
}

/** Result of checking the capability dependencies of a registry entry. */
export interface GraphicsCapabilityDependencyResolution {
  satisfied: boolean;
  missing: string[];
}

/** Availability of an optional workspace capability. */
export type GraphicsCapabilityAvailability =
  | "available"
  | "unavailable"
  | "degraded"
  | "unknown";

/** A capability card rendered by the workspace without binding to a specific tool. */
export interface GraphicsWorkspaceCapability {
  id:
    | "feature-planning"
    | "source-analysis"
    | "asset-validation"
    | "runtime-capture";
  label: string;
  description: string;
  availability: GraphicsCapabilityAvailability;
  providerId?: GraphicsProviderId;
  providerName?: string;
  reason?: string;
}

/** Payload returned for the lazily requested runtime provider status. */
export interface GraphicsProviderStatusPayload {
  providers: GraphicsProviderStatusInfo[];
  selectedProviderId?: GraphicsProviderId;
  capabilitiesByProviderId: Record<
    GraphicsProviderId,
    GraphicsProviderCapabilities | null
  >;
}

/** Runtime capture metadata exposed to the Graphics Workspace. */
export interface GraphicsCaptureStatusPayload {
  status: GraphicsProviderStatus;
  providerId?: GraphicsProviderId;
  providerName?: string;
  capturePath?: string;
  api?: string;
  gpu?: string;
  width?: number;
  height?: number;
  frameNumber?: number;
  selectedEventId?: number;
  replayAvailable?: boolean;
  refreshedAt: string;
  message?: string;
}

/** Result returned by a runtime capture query. */
export interface GraphicsCaptureOperationPayload<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Wire-safe AssetStudio provider status exposed to the Graphics Workspace. */
export interface GraphicsAssetProviderStatusPayload {
  providerId: string;
  providerName: string;
  availability: GraphicsCapabilityAvailability;
  health: GraphicsCapabilityHealth;
  serverName?: string;
  message?: string;
  diagnostics: string[];
  checkedAt: string;
  capabilities: Record<string, boolean>;
}

export interface GraphicsAssetArtifactPayload {
  artifactId: string;
  path: string;
  kind?: string;
  loadedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphicsAssetInventoryPayload {
  artifact: GraphicsAssetArtifactPayload;
  assets: Array<{
    id: string;
    name?: string;
    path?: string;
    kind: string;
    guid?: string;
    bundle?: string;
    address?: string;
    dependencies?: string[];
    memoryBytes?: number;
  }>;
  totals: {
    assetCount: number;
    memoryBytes?: number;
    byKind: Record<string, number>;
    bundleCount?: number;
    dependencyCount?: number;
  };
  generatedAt: string;
}

export interface GraphicsAssetOperationPayload<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  diagnostics?: string[];
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
  | { type: "findOwnerInProject" };

/**
 * Messages sent from backend to frontend with graphics results.
 */
export interface GraphicsResultMessage {
  type: "graphicsResult";
  result: GraphicsWorkflowResult;
  providerId: string;
  providerName: string;
  timestamp: number;
}
