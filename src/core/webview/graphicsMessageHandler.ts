/**
 * Graphics Message Handler
 *
 * Handles webview messages related to the graphics agent.
 * Routes messages to the appropriate graphics workflow or playbook.
 *
 * @module webview/graphicsMessageHandler
 */

import { RooCodeEventName } from "@roo-code/types"
import type { TaskLike } from "@roo-code/types"
import type {
	GraphicsFeatureAcceptanceCheck,
	GraphicsFeatureBrief,
	GraphicsFeaturePlan,
	GraphicsFeaturePlanArtifacts,
	GraphicsFeatureRisk,
	GraphicsFeatureTaskExecution,
	GraphicsFeatureTaskStatus,
	GraphicsIntent,
	GraphicsPlaybookId,
	GraphicsProjectProfile,
	WebviewMessage,
} from "@roo-code/types"
import type { ClineProvider } from "./ClineProvider"
import { GraphicsProviderRegistry } from "../../services/graphics-provider/GraphicsProviderRegistry"
import { GraphicsAssetProviderRegistry } from "../../services/graphics-provider/GraphicsAssetProviderRegistry"
import { GraphicsCapabilityRegistry } from "../../services/graphics-agent/capabilities/GraphicsCapabilityRegistry"
import { ASSET_STUDIO_CAPABILITIES } from "../../services/graphics-provider/providers/asset-studio-mcp/AssetStudioMcpProvider"
import { GraphicsWorkflowOrchestrator } from "../../services/graphics-agent/GraphicsWorkflowOrchestrator"
import { RenderDocVsCodeMcpProvider } from "../../services/graphics-provider/providers/renderdoc-vscode-mcp/RenderDocVsCodeMcpProvider"
import { AssetStudioMcpProvider } from "../../services/graphics-provider/providers/asset-studio-mcp/AssetStudioMcpProvider"
import { AnalyzeCurrentFrameWorkflow } from "../../services/graphics-agent/workflows/analyzeCurrentFrame"
import { LaunchAndCaptureWorkflow } from "../../services/graphics-agent/workflows/launchAndCapture"
import { ValidateGraphicsFixWorkflow } from "../../services/graphics-agent/workflows/validateGraphicsFix"
import { ExplainSelectedDrawWorkflow } from "../../services/graphics-agent/workflows/explainSelectedDraw"
import { FindOwnerInProjectWorkflow } from "../../services/graphics-agent/workflows/findOwnerInProject"
import {
	FramePerformanceWorkflow,
	ShaderAnalysisWorkflow,
	PipelineAnalysisWorkflow,
	ResourceTraceWorkflow,
	CaptureCompareWorkflow,
} from "../../services/graphics-agent/workflows/runtimeDiagnostics"
import { GraphicsLaunchProfileStore } from "../../services/graphics-agent/persistence/GraphicsLaunchProfileStore"
import { GraphicsRuntimeCache } from "../../services/graphics-agent/GraphicsRuntimeCache"
import {
	runPlaybook,
	detectPlaybookFromMessage,
	getPlaybook,
} from "../../services/graphics-agent/playbooks/playbookRunner"
import { createGraphicsFeaturePlan } from "../../services/graphics-agent/planning/GraphicsFeaturePlanner"
import { profileGraphicsProject } from "../../services/graphics-agent/planning/GraphicsProjectProfiler"
import { selectGraphicsSolution } from "../../services/graphics-agent/planning/GraphicsSolutionSelector"
import {
	GraphicsFeatureWorkspaceStore,
	type GraphicsWorkspaceSnapshot,
} from "../../services/graphics-agent/persistence/GraphicsFeatureWorkspaceStore"
import { mergeGraphicsFeaturePlans } from "../../services/graphics-agent/planning/GraphicsFeaturePlanMerger"
import type { GraphicsSolutionLevel } from "@roo-code/types"
import type { GraphicsProviderCapabilities } from "../../services/graphics-provider/GraphicsProviderTypes"
import {
	orchestrateGraphicsKnowledge,
	buildGraphicsContextBlock,
	captureKnowledge,
	buildCaptureContent,
} from "../../services/graphics-agent/knowledge"

/**
 * Singleton graphics agent instances.
 * These are lazily initialized on first use.
 */
let graphicsRegistry: GraphicsProviderRegistry | null = null
let graphicsAssetRegistry: GraphicsAssetProviderRegistry | null = null
let graphicsAssetCapabilities: GraphicsCapabilityRegistry | null = null
let graphicsOrchestrator: GraphicsWorkflowOrchestrator | null = null
const graphicsRuntimeCache = new GraphicsRuntimeCache()
const GRAPHICS_FEATURE_BRIEF_WORKSPACE_KEY = "graphicsFeatureBrief"
const GRAPHICS_FEATURE_PLAN_WORKSPACE_KEY = "graphicsFeaturePlan"

/** Keeps the concrete Agent Task available for targeted cancellation without touching the foreground task API. */
const graphicsExecutionTasks = new Map<string, TaskLike>()
/** Tracks cancellable graphics workflow operations by their stable operation/request identity. */
const graphicsOperationControllers = new Map<string, AbortController>()
/** Carries an explicit user cancellation reason into the asynchronous TaskAborted callback. */
const graphicsExecutionCancellationReasons = new Map<string, string>()
/** Serializes asynchronous execution writes so output, logs, and terminal state cannot overwrite each other. */
const graphicsExecutionUpdateQueues = new Map<string, Promise<void>>()

/** Releases all in-memory graphics execution and provider resources. */
export function disposeGraphicsExecutionRuntime(): void {
	for (const task of graphicsExecutionTasks.values()) task.abortTask()
	for (const controller of graphicsOperationControllers.values()) controller.abort()
	graphicsExecutionTasks.clear()
	graphicsOperationControllers.clear()
	graphicsExecutionCancellationReasons.clear()
	graphicsExecutionUpdateQueues.clear()
	graphicsRegistry = null
	graphicsAssetRegistry = null
	graphicsAssetCapabilities = null
	graphicsOrchestrator = null
}

/** Creates the project-file store per request so tests and multiple workspaces never share path state. */
function getGraphicsFeatureWorkspaceStore(provider: ClineProvider): GraphicsFeatureWorkspaceStore {
	return new GraphicsFeatureWorkspaceStore(provider.cwd, (message) => provider.log(message))
}

/** Reads the current shared plan snapshot for optimistic multi-window writes. */
async function loadGraphicsFeaturePlanSnapshot(
	provider: ClineProvider,
): Promise<GraphicsWorkspaceSnapshot<GraphicsFeaturePlan> | undefined> {
	return getGraphicsFeatureWorkspaceStore(provider).loadPlanSnapshot()
}

/** Sends a consistent conflict response when the project file changed outside this window. */
async function postGraphicsFeaturePlanConflict(
	provider: ClineProvider,
	currentPlan: GraphicsFeaturePlan | undefined,
	error: string,
): Promise<void> {
	await provider.postMessageToWebview({
		type: "graphicsFeaturePlanConflict",
		graphicsFeaturePlan: currentPlan,
		graphicsFeaturePlanError: error,
		graphicsFeaturePlanConflict: {
			currentRevision: currentPlan?.revision,
			currentPlan,
			path: getGraphicsFeatureWorkspaceStore(provider).getPlanPath(),
		},
	})
}

/**
 * Persists a plan only when the project snapshot observed before editing is still current.
 * This helper keeps every plan-edit handler on the same multi-window conflict path.
 */
async function persistGraphicsFeaturePlanEdit(
	provider: ClineProvider,
	plan: GraphicsFeaturePlan,
	snapshot: GraphicsWorkspaceSnapshot<GraphicsFeaturePlan> | undefined,
): Promise<boolean> {
	const store = getGraphicsFeatureWorkspaceStore(provider)
	const result = snapshot
		? await store.savePlanIfUnchanged(plan, snapshot)
		: { saved: await store.savePlan(plan), conflict: false }
	if (result.conflict) {
		await postGraphicsFeaturePlanConflict(
			provider,
			result.current?.value,
			"The shared plan changed before this edit was saved.",
		)
		return false
	}
	// Keep workspaceState as the compatibility fallback even when project persistence is unavailable.
	await saveGraphicsFeaturePlan(provider, plan)
	return true
}

/** Reads the project file first and falls back to workspaceState for legacy and no-workspace sessions. */
async function loadGraphicsFeatureBrief(provider: ClineProvider): Promise<GraphicsFeatureBrief | undefined> {
	const projectBrief = await getGraphicsFeatureWorkspaceStore(provider).loadBrief()
	return (
		projectBrief ?? provider.context.workspaceState.get<GraphicsFeatureBrief>(GRAPHICS_FEATURE_BRIEF_WORKSPACE_KEY)
	)
}

/** Restores the team-shared profile before scanning so plan requests remain deterministic across windows. */
async function loadGraphicsProjectProfile(provider: ClineProvider): Promise<GraphicsProjectProfile> {
	const store = getGraphicsFeatureWorkspaceStore(provider)
	return (await store.loadProfile()) ?? profileGraphicsProject(provider.cwd)
}

/** Reads the team-shared plan first while keeping workspaceState as a fast compatibility cache. */
async function loadGraphicsFeaturePlan(provider: ClineProvider): Promise<GraphicsFeaturePlan | undefined> {
	const projectPlan = await getGraphicsFeatureWorkspaceStore(provider).loadPlan()
	return projectPlan ?? provider.context.workspaceState.get<GraphicsFeaturePlan>(GRAPHICS_FEATURE_PLAN_WORKSPACE_KEY)
}

/** Updates both stores; project persistence is best-effort so it cannot break existing Webview behavior. */
async function saveGraphicsFeatureBrief(provider: ClineProvider, brief: GraphicsFeatureBrief): Promise<void> {
	await provider.context.workspaceState.update(GRAPHICS_FEATURE_BRIEF_WORKSPACE_KEY, brief)
	await getGraphicsFeatureWorkspaceStore(provider).saveBrief(brief)
}

/** Keeps the compatibility cache and all independently recoverable artifacts on the same plan revision. */
async function saveGraphicsFeaturePlan(provider: ClineProvider, plan: GraphicsFeaturePlan): Promise<void> {
	const store = getGraphicsFeatureWorkspaceStore(provider)
	await provider.context.workspaceState.update(GRAPHICS_FEATURE_PLAN_WORKSPACE_KEY, plan)
	await store.savePlan(plan)
	await store.savePlanArtifacts(plan)
}

/** Restores split artifacts while projecting legacy plans into the same bundle shape. */
async function loadGraphicsFeaturePlanArtifacts(
	provider: ClineProvider,
	plan: GraphicsFeaturePlan | undefined,
): Promise<GraphicsFeaturePlanArtifacts | undefined> {
	return getGraphicsFeatureWorkspaceStore(provider).loadPlanArtifacts(plan)
}

/**
 * Get or create the graphics provider registry.
 */
function getGraphicsRegistry(provider: ClineProvider): GraphicsProviderRegistry {
	if (!graphicsRegistry) {
		graphicsRegistry = new GraphicsProviderRegistry()

		// Register MCP providers from the host hub. Asset analysis remains separate
		// from capture selection, but shares the same lifecycle and MCP discovery.
		const mcpHub = provider.getMcpHub()
		if (mcpHub) {
				graphicsRegistry.registerProvider(new RenderDocVsCodeMcpProvider(mcpHub))
				// AssetStudio is an asset provider, not a capture provider. Its lifecycle
				// is exposed through the Asset/Build protocol rather than capture selection.
			}
	}
	return graphicsRegistry
}

function getGraphicsAssetRegistry(provider: ClineProvider): GraphicsAssetProviderRegistry {
	if (!graphicsAssetRegistry) {
		graphicsAssetRegistry = new GraphicsAssetProviderRegistry()
		const mcpHub = provider.getMcpHub()
		if (mcpHub) graphicsAssetRegistry.registerProvider(new AssetStudioMcpProvider(mcpHub))
	}
	return graphicsAssetRegistry
}

async function getGraphicsAssetCapabilities(provider: ClineProvider): Promise<GraphicsCapabilityRegistry> {
	if (!graphicsAssetCapabilities) graphicsAssetCapabilities = new GraphicsCapabilityRegistry()
	const assetRegistry = getGraphicsAssetRegistry(provider)
	const providers = assetRegistry.listProviders()
	const activeProviderIds = new Set(providers.map((assetProvider) => assetProvider.id))

	for (const entry of graphicsAssetCapabilities.list()) {
		if (
			entry.descriptor.sourceKind === "provider" &&
			!activeProviderIds.has(entry.descriptor.sourceId)
		) {
			graphicsAssetCapabilities.unregister("provider", entry.descriptor.sourceId)
		}
	}

	for (const assetProvider of providers) {
		const status = await assetProvider.getStatus()
		graphicsAssetCapabilities.register({
			descriptor: {
				id: assetProvider.id,
				label: assetProvider.displayName,
				sourceKind: "provider",
				sourceId: assetProvider.id,
				providedCapabilities: [...ASSET_STUDIO_CAPABILITIES],
				availability: status.availability,
				health: status.health,
				reason: status.message,
				diagnostics: status.diagnostics,
			},
			registeredAt: status.checkedAt,
		})
	}
	return graphicsAssetCapabilities
}

/**
 * Get or create the graphics workflow orchestrator.
 */
function getGraphicsOrchestrator(provider: ClineProvider): GraphicsWorkflowOrchestrator {
	if (!graphicsOrchestrator) {
		const registry = getGraphicsRegistry(provider)
		graphicsOrchestrator = new GraphicsWorkflowOrchestrator(registry)

		// Register built-in workflows
		graphicsOrchestrator.registerWorkflow(new AnalyzeCurrentFrameWorkflow())
		graphicsOrchestrator.registerWorkflow(new ExplainSelectedDrawWorkflow())
		graphicsOrchestrator.registerWorkflow(new FindOwnerInProjectWorkflow())
		graphicsOrchestrator.registerWorkflow(new FramePerformanceWorkflow(graphicsRuntimeCache))
		graphicsOrchestrator.registerWorkflow(new ShaderAnalysisWorkflow(graphicsRuntimeCache))
		graphicsOrchestrator.registerWorkflow(new PipelineAnalysisWorkflow(graphicsRuntimeCache))
		graphicsOrchestrator.registerWorkflow(new ResourceTraceWorkflow(graphicsRuntimeCache))
		graphicsOrchestrator.registerWorkflow(new CaptureCompareWorkflow())
	}
	return graphicsOrchestrator
}

/**
 * Handle graphics-related webview messages.
 *
 * @param provider - The ClineProvider instance
 * @param message - The webview message
 * @returns true if the message was handled, false otherwise
 */
/** Returns true when a task's dependencies are all complete and it can be delegated. */
function canExecuteGraphicsTask(plan: GraphicsFeaturePlan, taskId: string): boolean {
	const task = plan.tasks.find((candidate) => candidate.id === taskId)
	return Boolean(
		task &&
			task.dependsOn.every(
				(dependencyId) => plan.tasks.find((candidate) => candidate.id === dependencyId)?.status === "completed",
			),
	)
}

/** Creates a stable execution identity without coupling persistence to the underlying Agent Task ID. */
function createGraphicsExecutionId(taskId: string): string {
	return `graphics-${taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Computes a compact structural plan identity while ignoring mutable execution status fields. */
function getGraphicsPlanFingerprint(plan: GraphicsFeaturePlan): string {
	return [
		plan.title,
		plan.briefSummary,
		...plan.tasks.map(
			(task) => `${task.id}:${task.title}:${task.owner}:${task.dependsOn.join(",")}:${task.completionConditions.join(";")}`,
		),
	].join("|")
}

/** Computes an execution update from the latest persisted record to avoid stale async merges. */
type GraphicsExecutionUpdate =
	| Partial<GraphicsFeatureTaskExecution>
	| ((execution: GraphicsFeatureTaskExecution) => Partial<GraphicsFeatureTaskExecution>)

/** Updates one execution record and broadcasts the complete plan for deterministic Webview reconciliation. */
async function updateGraphicsExecutionNow(
	provider: ClineProvider,
	executionId: string,
	update: GraphicsExecutionUpdate,
): Promise<void> {
	const snapshot = await loadGraphicsFeaturePlanSnapshot(provider)
	const plan = snapshot?.value ?? (await loadGraphicsFeaturePlan(provider))
	if (!plan) return
	const execution = plan.executions?.find((candidate) => candidate.executionId === executionId)
	if (!execution) return
	if (execution.planFingerprint && execution.planFingerprint !== getGraphicsPlanFingerprint(plan)) {
		provider.log(`[Graphics] ignored stale execution update for ${executionId}`)
		return
	}
	const now = new Date().toISOString()
	const resolvedUpdate = typeof update === "function" ? update(execution) : update
	const updatedExecution = { ...execution, ...resolvedUpdate, updatedAt: now }
	const nextPlan: GraphicsFeaturePlan = {
		...plan,
		revision: plan.revision + 1,
		updatedAt: now,
		executions: plan.executions?.map((candidate) =>
			candidate.executionId === executionId ? updatedExecution : candidate,
		),
		tasks: plan.tasks.map((task) =>
			task.id === execution.taskId && resolvedUpdate.status
				? {
						...task,
						status:
							resolvedUpdate.status === "succeeded"
								? "completed"
								: resolvedUpdate.status === "failed" || resolvedUpdate.status === "cancelled"
									? "pending"
									: "in-progress",
						statusUpdatedAt: now,
					}
				: task,
		),
	}
	if (!(await persistGraphicsFeaturePlanEdit(provider, nextPlan, snapshot))) return
	await provider.postMessageToWebview({ type: "graphicsFeatureTaskExecutionUpdated", graphicsFeaturePlan: nextPlan })
}

/** Queues one execution update behind all prior updates for the same attempt. */
function updateGraphicsExecution(
	provider: ClineProvider,
	executionId: string,
	update: GraphicsExecutionUpdate,
): Promise<void> {
	const previous = graphicsExecutionUpdateQueues.get(executionId) ?? Promise.resolve()
	const next = previous
		.catch(() => undefined)
		.then(() => updateGraphicsExecutionNow(provider, executionId, update))
	graphicsExecutionUpdateQueues.set(executionId, next)
	void next.finally(() => {
		if (graphicsExecutionUpdateQueues.get(executionId) === next) graphicsExecutionUpdateQueues.delete(executionId)
	})
	return next
}

async function handleExecuteGraphicsFeatureTask(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const snapshot = await loadGraphicsFeaturePlanSnapshot(provider)
	const plan = snapshot?.value ?? (await loadGraphicsFeaturePlan(provider))
	const taskId = message.graphicsFeatureTaskId
	if (!plan || !taskId || !canExecuteGraphicsTask(plan, taskId)) {
		provider.log("[Graphics] executeGraphicsFeatureTask: task is missing or blocked by dependencies")
		return
	}
	if (message.graphicsFeaturePlanRevision !== undefined && message.graphicsFeaturePlanRevision !== plan.revision) {
		await postGraphicsFeaturePlanConflict(provider, plan, "The plan changed before execution was queued.")
		return
	}
	const now = new Date().toISOString()
	const task = plan.tasks.find((candidate) => candidate.id === taskId)!
	const execution: GraphicsFeatureTaskExecution = {
		executionId: createGraphicsExecutionId(taskId),
		taskId,
		executor: message.graphicsFeatureTaskExecutor ?? "agent",
		role: message.graphicsFeatureTaskRole ?? task.owner,
		status: "queued",
		retryCount: 0,
		updatedAt: now,
		planRevision: plan.revision,
		planFingerprint: getGraphicsPlanFingerprint(plan),
		logs: [{ timestamp: now, level: "info", message: "Execution queued." }],
	}
	const updatedPlan: GraphicsFeaturePlan = {
		...plan,
		revision: plan.revision + 1,
		source: "manual",
		updatedAt: now,
		executions: [...(plan.executions ?? []), execution],
		tasks: plan.tasks.map((candidate) =>
			candidate.id === taskId ? { ...candidate, status: "in-progress", statusUpdatedAt: now } : candidate,
		),
	}
	if (!(await persistGraphicsFeaturePlanEdit(provider, updatedPlan, snapshot))) return
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })

	// Human execution is intentionally a persisted queue item. Agent execution uses
	// the existing Task runtime, but does not call provider.cancelTask(), which would
	// incorrectly cancel the user's foreground chat task.
	if (execution.executor === "agent") {
		void runGraphicsAgentExecution(provider, task, execution)
	}
}

/** Cancels only the Agent Task associated with this execution, never the user's active chat Task. */
async function handleCancelGraphicsFeatureTaskExecution(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const executionId = message.graphicsFeatureExecutionId
	if (!executionId) return

	const agentTask = graphicsExecutionTasks.get(executionId)
	if (!agentTask) {
		provider.log(`[Graphics] cancel: execution ${executionId} has no active Agent Task`)
		return
	}

	// TaskLike exposes abortTask as the safe task-scoped cancellation boundary.
	graphicsExecutionCancellationReasons.set(executionId, "Cancelled from Graphics Feature Plan.")
	// The task-scoped abort event persists the terminal state and reason.
	agentTask.abortTask()
}

/** Creates a new attempt after a failed/cancelled execution while retaining the prior attempt history. */
async function handleRetryGraphicsFeatureTaskExecution(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const snapshot = await loadGraphicsFeaturePlanSnapshot(provider)
	const plan = snapshot?.value ?? (await loadGraphicsFeaturePlan(provider))
	const executionId = message.graphicsFeatureExecutionId
	const previous = plan?.executions?.find((execution) => execution.executionId === executionId)
	if (!plan || !previous || (previous.status !== "failed" && previous.status !== "cancelled")) return
	if (message.graphicsFeaturePlanRevision !== undefined && message.graphicsFeaturePlanRevision !== plan.revision) {
		await postGraphicsFeaturePlanConflict(provider, plan, "The plan changed before retry was queued.")
		return
	}
	const task = plan.tasks.find((candidate) => candidate.id === previous.taskId)
	if (!task || !canExecuteGraphicsTask(plan, task.id)) {
		provider.log(`[Graphics] retry: task ${previous.taskId} is blocked by dependencies`)
		return
	}

	const now = new Date().toISOString()
	const retry: GraphicsFeatureTaskExecution = {
		...previous,
		executionId: createGraphicsExecutionId(previous.taskId),
		status: "queued",
		retryCount: (previous.retryCount ?? 0) + 1,
		startedAt: undefined,
		finishedAt: undefined,
		updatedAt: now,
		output: undefined,
		error: undefined,
		cancellationReason: undefined,
		logs: [{ timestamp: now, level: "info", message: `Retry ${ (previous.retryCount ?? 0) + 1 } queued.` }],
		agentTaskId: undefined,
		planRevision: plan.revision,
		planFingerprint: getGraphicsPlanFingerprint(plan),
	}
	const nextPlan: GraphicsFeaturePlan = {
		...plan,
		revision: plan.revision + 1,
		updatedAt: now,
		executions: [...(plan.executions ?? []), retry],
		tasks: plan.tasks.map((candidate) =>
			candidate.id === task.id ? { ...candidate, status: "in-progress", statusUpdatedAt: now } : candidate,
		),
	}
	if (!(await persistGraphicsFeaturePlanEdit(provider, nextPlan, snapshot))) return
	await provider.postMessageToWebview({ type: "graphicsFeatureTaskExecutionUpdated", graphicsFeaturePlan: nextPlan })
	if (retry.executor === "agent") void runGraphicsAgentExecution(provider, task, retry)
}

/** Runs one Agent attempt and maps Task lifecycle events into the Graphics execution state machine. */
async function runGraphicsAgentExecution(
	provider: ClineProvider,
	task: GraphicsFeaturePlan["tasks"][number],
	execution: GraphicsFeatureTaskExecution,
): Promise<void> {
	if (!execution.executionId) return

	try {
		// Attach the graphics execution to the current task when possible. This keeps
		// createTask from removing the user's foreground task as it would for a new
		// top-level task, while preserving a top-level fallback for background use.
		const foregroundTask = provider.getCurrentTask()
		const agentTask = await provider.createTask(
			`Implement Graphics Feature task ${task.id}: ${task.title}\n\nCompletion conditions:\n${task.completionConditions.join("\n")}`,
			undefined,
			foregroundTask,
			{ startTask: true, initialStatus: "active" },
		)
		const executionId = execution.executionId
		graphicsExecutionTasks.set(executionId, agentTask)
		const startedAt = new Date().toISOString()

		await updateGraphicsExecution(provider, executionId, {
			status: "running",
			agentTaskId: agentTask.taskId,
			startedAt,
			logs: [
				...(execution.logs ?? []),
				{ timestamp: startedAt, level: "info", message: "Agent Task started." },
			],
		})

		await new Promise<void>((resolve) => {
			let settled = false

			const cleanup = () => {
				agentTask.off(RooCodeEventName.TaskCompleted, onTaskCompleted)
				agentTask.off(RooCodeEventName.TaskAborted, onTaskAborted)
				agentTask.off(RooCodeEventName.Message, onTaskMessage)
				agentTask.off(RooCodeEventName.TaskToolFailed, onTaskToolFailed)
			}

			/** Persists a diagnostic event from the latest queued execution snapshot. */
			const appendLog = async (level: "info" | "warning" | "error", message: string) => {
				await updateGraphicsExecution(provider, executionId, (currentExecution) => ({
					logs: [
						...(currentExecution.logs ?? []),
						{ timestamp: new Date().toISOString(), level, message },
					],
				}))
			}

			/** Stores assistant text separately from operational logs and ignores repeated updates. */
			const appendOutput = async (message: string) => {
				await updateGraphicsExecution(provider, executionId, (currentExecution) => {
					const output = currentExecution.output ?? []
					return output.includes(message) ? {} : { output: [...output, message] }
				})
			}

			const complete = async (status: "succeeded" | "cancelled") => {
				if (settled) return
				settled = true
				cleanup()
				const timestamp = new Date().toISOString()
				const cancellationReason = graphicsExecutionCancellationReasons.get(executionId)
				await updateGraphicsExecution(provider, executionId, (currentExecution) => ({
					status,
					finishedAt: timestamp,
					cancellationReason,
					logs: [
						...(currentExecution.logs ?? []),
						{
							timestamp,
							level: status === "cancelled" ? "warning" : "info",
							message: `Agent Task ${status}.`,
						},
					],
				}))
				graphicsExecutionTasks.delete(executionId)
				graphicsExecutionCancellationReasons.delete(executionId)
				resolve()
			}

			const onTaskCompleted = () => void complete("succeeded")
			const onTaskAborted = () => void complete("cancelled")
			const onTaskMessage = ({ message }: { action: "created" | "updated"; message: { text?: string } }) => {
				const text = message.text?.trim()
				if (text) {
					// Keep human-readable Agent output distinct from lifecycle and tool diagnostics.
					void appendOutput(text)
					void appendLog("info", text)
				}
			}
			const onTaskToolFailed = (_taskId: string, tool: string, error: string) => {
				const message = `Tool ${tool} failed: ${error}`
				// Keep the attempt visibly failed while allowing the Task lifecycle event to
				// provide the final terminal state and completion timestamp.
				void appendLog("error", message)
				void updateGraphicsExecution(provider, executionId, { error: message })
			}

			// Task-scoped events avoid observing unrelated foreground tasks and keep
			// output and diagnostics attached to this execution attempt.
			agentTask.on(RooCodeEventName.TaskCompleted, onTaskCompleted)
			agentTask.on(RooCodeEventName.TaskAborted, onTaskAborted)
			agentTask.on(RooCodeEventName.Message, onTaskMessage)
			agentTask.on(RooCodeEventName.TaskToolFailed, onTaskToolFailed)
		})
	} catch (error) {
		const timestamp = new Date().toISOString()
		graphicsExecutionTasks.delete(execution.executionId)
		graphicsExecutionCancellationReasons.delete(execution.executionId)
		const failureMessage = error instanceof Error ? error.message : String(error)
		await updateGraphicsExecution(provider, execution.executionId, (currentExecution) => ({
			status: "failed",
			finishedAt: timestamp,
			error: failureMessage,
			logs: [
				...(currentExecution.logs ?? []),
				{ timestamp, level: "error", message: failureMessage },
			],
		}))
	}
}

export async function handleGraphicsMessage(provider: ClineProvider, message: WebviewMessage): Promise<boolean> {
	switch (message.type) {
		case "runGraphicsWorkflow":
			await handleRunGraphicsWorkflow(provider, message)
			return true

		case "runGraphicsLaunchAndCapture":
			await handleRunGraphicsWorkflow(provider, {
				...message,
				type: "runGraphicsWorkflow",
				graphicsIntent: "launch_and_capture",
			})
			return true

		case "runGraphicsRecaptureValidation":
			await handleRunGraphicsWorkflow(provider, {
				...message,
				type: "runGraphicsWorkflow",
				graphicsIntent: "recapture_validation",
			})
			return true

		case "requestGraphicsLaunchProfiles": {
			const store = new GraphicsLaunchProfileStore(provider.cwd, (entry) => provider.log(entry))
			await provider.postMessageToWebview({ type: "graphicsLaunchProfiles", graphicsLaunchProfiles: await store.listProfiles() })
			return true
		}

		case "saveGraphicsLaunchProfile": {
			const store = new GraphicsLaunchProfileStore(provider.cwd, (entry) => provider.log(entry))
			if (message.graphicsProfile) await store.saveProfile(message.graphicsProfile)
			await provider.postMessageToWebview({ type: "graphicsLaunchProfiles", graphicsLaunchProfiles: await store.listProfiles() })
			return true
		}

		case "deleteGraphicsLaunchProfile": {
			const store = new GraphicsLaunchProfileStore(provider.cwd, (entry) => provider.log(entry))
			if (message.graphicsProfileId) await store.deleteProfile(message.graphicsProfileId)
			await provider.postMessageToWebview({ type: "graphicsLaunchProfiles", graphicsLaunchProfiles: await store.listProfiles() })
			return true
		}

		case "requestGraphicsInvestigationSession": {
			const store = new GraphicsLaunchProfileStore(provider.cwd, (entry) => provider.log(entry))
			const session = message.graphicsSessionId ? await store.loadSession(message.graphicsSessionId) : undefined
			await provider.postMessageToWebview({ type: "graphicsInvestigationSession", graphicsInvestigationSession: session })
			return true
		}

		case "cancelGraphicsOperation": {
			const operationId = message.graphicsOperationId ?? message.requestId
			const controller = operationId ? graphicsOperationControllers.get(operationId) : undefined
			if (controller) controller.abort()
			await provider.postMessageToWebview({
				type: "graphicsResult",
				requestId: message.requestId,
				values: {
					result: {
						success: false,
						summary: controller ? "Graphics operation cancellation requested." : "Graphics operation is not running.",
						evidence: [],
						suspectedIssues: [],
						suggestions: controller ? ["The provider is stopping the active operation."] : ["Start a new graphics operation."],
						error: "CANCELLED",
					},
					providerId: "unknown",
					providerName: "Unknown",
					timestamp: Date.now(),
				},
			} as any)
			return true
		}

		case "invalidateGraphicsCache":
			graphicsRuntimeCache.invalidate()
			await provider.postMessageToWebview({ type: "graphicsResult", requestId: message.requestId, values: { cacheRevision: graphicsRuntimeCache.currentRevision, cacheInvalidated: true } } as any)
			return true

		case "runGraphicsPlaybook":
			await handleRunGraphicsPlaybook(provider, message)
			return true

		case "selectGraphicsProvider":
			await handleSelectGraphicsProvider(provider, message)
			return true

		case "requestGraphicsProviderStatus":
			await handleRequestGraphicsProviderStatus(provider)
			return true

		case "requestGraphicsCaptureStatus":
			await handleRequestGraphicsCaptureStatus(provider)
			return true

		case "requestGraphicsFrameSummary":
			await handleRequestGraphicsFrameSummary(provider, message)
			return true

		case "requestGraphicsSelectionContext":
			await handleRequestGraphicsSelectionContext(provider, message)
			return true

		case "requestGraphicsEventDetails":
			await handleRequestGraphicsEventDetails(provider, message)
			return true

		case "requestGraphicsPipelineState":
			await handleRequestGraphicsPipelineState(provider, message)
			return true

		case "requestGraphicsShaderInfo":
			await handleRequestGraphicsShaderInfo(provider, message)
			return true

		case "requestGraphicsAssetProviderStatus":
			await handleRequestGraphicsAssetProviderStatus(provider)
			return true

		case "loadGraphicsAssetArtifact":
			await handleLoadGraphicsAssetArtifact(provider, message)
			return true

		case "requestGraphicsAssetInventory":
			await handleRequestGraphicsAssetInventory(provider, message)
			return true

		case "requestGraphicsFeatureBrief":
			await handleRequestGraphicsFeatureBrief(provider)
			return true

		case "saveGraphicsFeatureBrief":
			await handleSaveGraphicsFeatureBrief(provider, message)
			return true

		case "requestGraphicsProjectProfile":
			await handleRequestGraphicsProjectProfile(provider)
			return true

		case "requestGraphicsSolutionRecommendation":
			await handleRequestGraphicsSolutionRecommendation(provider, message)
			return true

		case "requestGraphicsFeaturePlan":
			await handleRequestGraphicsFeaturePlan(provider, message)
			return true

		case "requestGraphicsFeaturePlanRecovery":
			await handleRequestGraphicsFeaturePlanRecovery(provider)
			return true

		case "previewGraphicsFeaturePlanMerge":
			await handlePreviewGraphicsFeaturePlanMerge(provider, message)
			return true

		case "mergeGraphicsFeaturePlan":
			await handleMergeGraphicsFeaturePlan(provider, message)
			return true

		case "updateGraphicsFeatureTaskStatus":
			await handleUpdateGraphicsFeatureTaskStatus(provider, message)
			return true
		case "executeGraphicsFeatureTask":
			await handleExecuteGraphicsFeatureTask(provider, message)
			return true

		case "cancelGraphicsFeatureTaskExecution":
			await handleCancelGraphicsFeatureTaskExecution(provider, message)
			return true

		case "retryGraphicsFeatureTaskExecution":
			await handleRetryGraphicsFeatureTaskExecution(provider, message)
			return true

		case "updateGraphicsFeatureTask":
			await handleUpdateGraphicsFeatureTask(provider, message)
			return true

		case "updateGraphicsFeaturePlan":
			await handleUpdateGraphicsFeaturePlan(provider, message)
			return true

		case "updateGraphicsFeaturePlanSection":
			await handleUpdateGraphicsFeaturePlanSection(provider, message)
			return true

		case "updateGraphicsFeatureAssetContract":
			await handleUpdateGraphicsFeatureAssetContract(provider, message)
			return true

		case "updateGraphicsFeaturePerformanceBudget":
			await handleUpdateGraphicsFeaturePerformanceBudget(provider, message)
			return true

		case "updateGraphicsFeatureDecision":
			await handleUpdateGraphicsFeatureDecision(provider, message)
			return true

		case "updateGraphicsFeatureCompatibility":
			await handleUpdateGraphicsFeatureCompatibility(provider, message)
			return true

		case "updateGraphicsFeaturePlanContext":
			await handleUpdateGraphicsFeaturePlanContext(provider, message)
			return true

		default:
			return false
	}
}

async function handleRequestGraphicsFeatureBrief(provider: ClineProvider): Promise<void> {
	const graphicsFeatureBrief = await loadGraphicsFeatureBrief(provider)
	await provider.postMessageToWebview({ type: "graphicsFeatureBrief", graphicsFeatureBrief })
}

async function handleSaveGraphicsFeatureBrief(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	if (!message.graphicsFeatureBrief || message.graphicsFeatureBrief.version !== 1) {
		provider.log("[Graphics] saveGraphicsFeatureBrief: missing or unsupported brief")
		return
	}

	await saveGraphicsFeatureBrief(provider, message.graphicsFeatureBrief)
	await provider.postMessageToWebview({
		type: "graphicsFeatureBrief",
		graphicsFeatureBrief: message.graphicsFeatureBrief,
	})
}

async function handleRequestGraphicsProjectProfile(provider: ClineProvider): Promise<void> {
	const store = getGraphicsFeatureWorkspaceStore(provider)
	const graphicsProjectProfile = await loadGraphicsProjectProfile(provider)
	// Persist the scan result so another window can restore the same planning context without rescanning.
	await store.saveProfile(graphicsProjectProfile)
	await provider.postMessageToWebview({ type: "graphicsProjectProfile", graphicsProjectProfile })
}

async function handleRequestGraphicsSolutionRecommendation(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	if (!message.graphicsFeatureBrief || message.graphicsFeatureBrief.version !== 1) {
		provider.log("[Graphics] requestGraphicsSolutionRecommendation: missing or unsupported brief")
		return
	}

	const graphicsProjectProfile = await loadGraphicsProjectProfile(provider)
	// Recompute for the submitted brief; reusing a different brief's recommendation would be unsafe.
	const graphicsSolutionRecommendation = selectGraphicsSolution(message.graphicsFeatureBrief, graphicsProjectProfile)
	await getGraphicsFeatureWorkspaceStore(provider).saveRecommendation(graphicsSolutionRecommendation)
	await provider.postMessageToWebview({
		type: "graphicsSolutionRecommendation",
		graphicsSolutionRecommendation,
	})
}

async function handleRequestGraphicsFeaturePlan(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	if (!message.graphicsFeatureBrief || message.graphicsFeatureBrief.version !== 1) {
		provider.log("[Graphics] requestGraphicsFeaturePlan: missing or unsupported brief")
		return
	}

	const graphicsProjectProfile = await loadGraphicsProjectProfile(provider)
	const graphicsSolutionRecommendation = selectGraphicsSolution(message.graphicsFeatureBrief, graphicsProjectProfile)
	const store = getGraphicsFeatureWorkspaceStore(provider)
	// Persist the inputs used to create the plan so recovery can explain and reproduce the decision later.
	await store.saveProfile(graphicsProjectProfile)
	await store.saveRecommendation(graphicsSolutionRecommendation)
	const graphicsFeaturePlan = createGraphicsFeaturePlan(
		message.graphicsFeatureBrief,
		graphicsProjectProfile,
		graphicsSolutionRecommendation,
	)
	await saveGraphicsFeaturePlan(provider, graphicsFeaturePlan)
	await provider.postMessageToWebview({ type: "graphicsFeaturePlan", graphicsFeaturePlan })
}

async function handleRequestGraphicsFeaturePlanRecovery(provider: ClineProvider): Promise<void> {
	const graphicsFeaturePlan = await loadGraphicsFeaturePlan(provider)
	const graphicsFeaturePlanArtifacts = await loadGraphicsFeaturePlanArtifacts(provider, graphicsFeaturePlan)
	await provider.postMessageToWebview({
		type: "graphicsFeaturePlanRecovered",
		graphicsFeaturePlan,
		graphicsFeaturePlanArtifacts,
	})
}

/** Builds a three-way preview from the draft's base, local edits, and current shared file. */
async function handlePreviewGraphicsFeaturePlanMerge(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const base = message.graphicsFeaturePlanBase
	const local = message.graphicsFeaturePlanLocal
	const current = (await loadGraphicsFeaturePlanSnapshot(provider))?.value ?? (await loadGraphicsFeaturePlan(provider))
	if (!base || !local || !current || base.version !== 1 || local.version !== 1 || current.version !== 1) {
		provider.log("[Graphics] previewGraphicsFeaturePlanMerge: missing valid base, local, or shared plan")
		return
	}
	const preview = mergeGraphicsFeaturePlans(base, local, current, message.graphicsFeaturePlanChoices)
	await provider.postMessageToWebview({
		type: "graphicsFeaturePlanMergePreview",
		graphicsFeaturePlanMergePreview: {
			baseRevision: base.revision,
			currentRevision: current.revision,
			mergedPlan: preview.mergedPlan,
			conflicts: preview.conflicts,
		},
	})
}

/** Saves a reviewed merge only if the shared file still equals the preview's current revision. */
async function handleMergeGraphicsFeaturePlan(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const base = message.graphicsFeaturePlanBase
	const local = message.graphicsFeaturePlanLocal
	const choices = message.graphicsFeaturePlanChoices ?? {}
	const snapshot = await loadGraphicsFeaturePlanSnapshot(provider)
	const current = snapshot?.value
	if (!base || !local || !current || !snapshot || base.version !== 1 || local.version !== 1 || current.version !== 1) {
		provider.log("[Graphics] mergeGraphicsFeaturePlan: missing valid merge versions")
		return
	}
	const preview = mergeGraphicsFeaturePlans(base, local, current, choices)
	if (preview.conflicts.some((conflict) => !choices[conflict.path])) {
		await provider.postMessageToWebview({
			type: "graphicsFeaturePlanMergePreview",
			graphicsFeaturePlanMergePreview: {
				baseRevision: base.revision,
				currentRevision: current.revision,
				mergedPlan: preview.mergedPlan,
				conflicts: preview.conflicts,
			},
		})
		return
	}
	const mergedPlan: GraphicsFeaturePlan = {
		...preview.mergedPlan,
		revision: current.revision + 1,
		source: "manual",
		updatedAt: new Date().toISOString(),
	}
	if (!(await persistGraphicsFeaturePlanEdit(provider, mergedPlan, snapshot))) return
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: mergedPlan })
}

const GRAPHICS_SOLUTION_LEVELS: readonly GraphicsSolutionLevel[] = [
	"configuration",
	"shader",
	"renderer-pass",
	"post-process",
	"render-graph",
	"compute",
	"cpu-client",
]

function isGraphicsSolutionLevel(value: unknown): value is GraphicsSolutionLevel {
	return GRAPHICS_SOLUTION_LEVELS.includes(value as GraphicsSolutionLevel)
}

/** Keeps manually edited risk rows inside the domain model's supported impact vocabulary. */
function isGraphicsFeatureRiskImpact(value: unknown): value is GraphicsFeatureRisk["impact"] {
	return value === "high" || value === "medium" || value === "low"
}

/** Keeps acceptance checks interoperable with downstream evidence collection and reporting. */
function isGraphicsFeatureAcceptanceDimension(value: unknown): value is GraphicsFeatureAcceptanceCheck["dimension"] {
	return value === "visual" || value === "functional" || value === "performance" || value === "compatibility"
}

/** Rejects unsupported evidence labels before they are persisted in workspaceState. */
function isGraphicsFeatureAcceptanceEvidence(value: unknown): value is GraphicsFeatureAcceptanceCheck["evidence"] {
	return (
		value === "screenshot" ||
		value === "automated-test" ||
		value === "build" ||
		value === "profiler" ||
		value === "capture" ||
		value === "device-test"
	)
}

function isGraphicsFeatureTaskStatus(value: unknown): value is GraphicsFeatureTaskStatus {
	return (
		value === "pending" ||
		value === "in-progress" ||
		value === "blocked" ||
		value === "completed" ||
		value === "skipped"
	)
}

async function handleUpdateGraphicsFeatureTaskStatus(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const taskId = message.graphicsFeatureTaskId
	const status = message.graphicsFeatureTaskStatus
	const snapshot = await loadGraphicsFeaturePlanSnapshot(provider)
	const plan = snapshot?.value ?? (await loadGraphicsFeaturePlan(provider))

	if (!plan || plan.version !== 1 || !taskId || !isGraphicsFeatureTaskStatus(status)) {
		provider.log("[Graphics] updateGraphicsFeatureTaskStatus: missing or invalid plan/task/status")
		return
	}
	if (message.graphicsFeaturePlanRevision !== undefined && message.graphicsFeaturePlanRevision !== plan.revision) {
		await provider.postMessageToWebview({
			type: "graphicsFeaturePlanConflict",
			graphicsFeaturePlan: plan,
			graphicsFeaturePlanError: "The plan changed before this task update was applied.",
		})
		return
	}
	if (!plan.tasks.some((task) => task.id === taskId)) {
		provider.log(`[Graphics] updateGraphicsFeatureTaskStatus: unknown task ${taskId}`)
		return
	}

	const updatedAt = new Date().toISOString()
	const updatedPlan: GraphicsFeaturePlan = {
		...plan,
		revision: plan.revision + 1,
		source: "workspace",
		updatedAt,
		tasks: plan.tasks.map((task) =>
			task.id === taskId
				? {
						...task,
						status,
						statusNote: message.graphicsFeatureTaskStatusNote?.trim() || undefined,
						statusUpdatedAt: updatedAt,
					}
				: task,
		),
	}
	if (!(await persistGraphicsFeaturePlanEdit(provider, updatedPlan, snapshot))) return
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanUpdated", graphicsFeaturePlan: updatedPlan })
}

async function handleUpdateGraphicsFeatureTask(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const snapshot = await loadGraphicsFeaturePlanSnapshot(provider)
	const taskId = message.graphicsFeatureTaskId
	const title = message.graphicsFeatureTaskTitle?.trim()
	const owner = message.graphicsFeatureTaskOwner
	const completionConditions = message.graphicsFeatureTaskCompletionConditions
	const plan = snapshot?.value ?? (await loadGraphicsFeaturePlan(provider))

	if (!plan || plan.version !== 1 || !taskId || (!title && !owner && !completionConditions)) {
		provider.log("[Graphics] updateGraphicsFeatureTask: missing or invalid plan/task fields")
		return
	}
	if (message.graphicsFeaturePlanRevision !== undefined && message.graphicsFeaturePlanRevision !== plan.revision) {
		await provider.postMessageToWebview({
			type: "graphicsFeaturePlanConflict",
			graphicsFeaturePlan: plan,
			graphicsFeaturePlanError: "The plan changed before this task edit was applied.",
		})
		return
	}

	const task = plan.tasks.find((candidate) => candidate.id === taskId)
	if (!task) {
		provider.log(`[Graphics] updateGraphicsFeatureTask: unknown task ${taskId}`)
		return
	}

	const updatedAt = new Date().toISOString()
	const updatedPlan: GraphicsFeaturePlan = {
		...plan,
		revision: plan.revision + 1,
		source: "manual",
		updatedAt,
		tasks: plan.tasks.map((candidate) =>
			candidate.id === taskId
				? {
						...candidate,
						...(title ? { title } : {}),
						...(owner ? { owner } : {}),
						...(completionConditions
							? {
									completionConditions: completionConditions
										.map((condition) => condition.trim())
										.filter(Boolean),
								}
							: {}),
					}
				: candidate,
		),
	}
	if (!(await persistGraphicsFeaturePlanEdit(provider, updatedPlan, snapshot))) return
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

async function handleUpdateGraphicsFeaturePlan(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const snapshot = await loadGraphicsFeaturePlanSnapshot(provider)
	const plan = snapshot?.value ?? (await loadGraphicsFeaturePlan(provider))
	const title = message.graphicsFeaturePlanTitle?.trim()
	const briefSummary = message.graphicsFeaturePlanBriefSummary?.trim()

	if (!plan || plan.version !== 1 || (title === undefined && briefSummary === undefined)) {
		provider.log("[Graphics] updateGraphicsFeaturePlan: missing or invalid plan fields")
		return
	}
	if (message.graphicsFeaturePlanRevision !== undefined && message.graphicsFeaturePlanRevision !== plan.revision) {
		await postGraphicsFeaturePlanConflict(provider, plan, "The plan changed before this edit was applied.")
		return
	}

	const updatedPlan: GraphicsFeaturePlan = {
		...plan,
		revision: plan.revision + 1,
		source: "manual",
		updatedAt: new Date().toISOString(),
		...(title !== undefined ? { title } : {}),
		...(briefSummary !== undefined ? { briefSummary } : {}),
	}
	if (!(await persistGraphicsFeaturePlanEdit(provider, updatedPlan, snapshot))) return
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

async function handleUpdateGraphicsFeaturePlanSection(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const snapshot = await loadGraphicsFeaturePlanSnapshot(provider)
	const plan = snapshot?.value ?? (await loadGraphicsFeaturePlan(provider))
	const sectionKey = message.graphicsFeaturePlanSection
	const summary = message.graphicsFeaturePlanSectionSummary?.trim()
	const details = message.graphicsFeaturePlanSectionDetails

	if (
		!plan ||
		plan.version !== 1 ||
		(sectionKey !== "pipelineDesign" && sectionKey !== "shaderDesign" && sectionKey !== "clientDesign") ||
		(summary === undefined && details === undefined)
	) {
		provider.log("[Graphics] updateGraphicsFeaturePlanSection: missing or invalid section fields")
		return
	}
	if (message.graphicsFeaturePlanRevision !== undefined && message.graphicsFeaturePlanRevision !== plan.revision) {
		await provider.postMessageToWebview({
			type: "graphicsFeaturePlanConflict",
			graphicsFeaturePlan: plan,
			graphicsFeaturePlanError: "The plan changed before this section edit was applied.",
		})
		return
	}

	const currentSection = plan[sectionKey]
	const updatedPlan: GraphicsFeaturePlan = {
		...plan,
		revision: plan.revision + 1,
		source: "manual",
		updatedAt: new Date().toISOString(),
		[sectionKey]: {
			...currentSection,
			...(summary !== undefined ? { summary } : {}),
			...(details !== undefined ? { details: details.map((detail) => detail.trim()).filter(Boolean) } : {}),
		},
	}
	if (!(await persistGraphicsFeaturePlanEdit(provider, updatedPlan, snapshot))) return
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

async function handleUpdateGraphicsFeatureAssetContract(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const snapshot = await loadGraphicsFeaturePlanSnapshot(provider)
	const plan = snapshot?.value ?? (await loadGraphicsFeaturePlan(provider))
	const requirements = message.graphicsFeatureAssetRequirements
	const validationRules = message.graphicsFeatureAssetValidationRules

	if (!plan || plan.version !== 1 || (requirements === undefined && validationRules === undefined)) {
		provider.log("[Graphics] updateGraphicsFeatureAssetContract: missing or invalid fields")
		return
	}
	if (message.graphicsFeaturePlanRevision !== undefined && message.graphicsFeaturePlanRevision !== plan.revision) {
		await provider.postMessageToWebview({
			type: "graphicsFeaturePlanConflict",
			graphicsFeaturePlan: plan,
			graphicsFeaturePlanError: "The plan changed before this asset contract edit was applied.",
		})
		return
	}

	const updatedPlan: GraphicsFeaturePlan = {
		...plan,
		revision: plan.revision + 1,
		source: "manual",
		updatedAt: new Date().toISOString(),
		assetContract: {
			...plan.assetContract,
			...(requirements !== undefined
				? { requirements: requirements.map((item) => item.trim()).filter(Boolean) }
				: {}),
			...(validationRules !== undefined
				? { validationRules: validationRules.map((item) => item.trim()).filter(Boolean) }
				: {}),
		},
	}
	if (!(await persistGraphicsFeaturePlanEdit(provider, updatedPlan, snapshot))) return
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

async function handleUpdateGraphicsFeaturePerformanceBudget(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const snapshot = await loadGraphicsFeaturePlanSnapshot(provider)
	const plan = snapshot?.value ?? (await loadGraphicsFeaturePlan(provider))
	const summary = message.graphicsFeaturePerformanceBudgetSummary?.trim()
	const details = message.graphicsFeaturePerformanceBudgetDetails

	if (!plan || plan.version !== 1 || (summary === undefined && details === undefined)) {
		provider.log("[Graphics] updateGraphicsFeaturePerformanceBudget: missing or invalid fields")
		return
	}
	if (message.graphicsFeaturePlanRevision !== undefined && message.graphicsFeaturePlanRevision !== plan.revision) {
		await provider.postMessageToWebview({
			type: "graphicsFeaturePlanConflict",
			graphicsFeaturePlan: plan,
			graphicsFeaturePlanError: "The plan changed before this performance budget edit was applied.",
		})
		return
	}

	const updatedPlan: GraphicsFeaturePlan = {
		...plan,
		revision: plan.revision + 1,
		source: "manual",
		updatedAt: new Date().toISOString(),
		performanceBudget: {
			...plan.performanceBudget,
			...(summary !== undefined ? { summary } : {}),
			...(details !== undefined ? { details: details.map((item) => item.trim()).filter(Boolean) } : {}),
		},
	}
	if (!(await persistGraphicsFeaturePlanEdit(provider, updatedPlan, snapshot))) return
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

async function handleUpdateGraphicsFeatureDecision(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const snapshot = await loadGraphicsFeaturePlanSnapshot(provider)
	const plan = snapshot?.value ?? (await loadGraphicsFeaturePlan(provider))
	const rationale = message.graphicsFeatureDecisionRationale
	const alternatives = message.graphicsFeatureDecisionAlternatives
	if (!plan || plan.version !== 1 || (rationale === undefined && alternatives === undefined)) {
		provider.log("[Graphics] updateGraphicsFeatureDecision: missing or invalid fields")
		return
	}
	if (message.graphicsFeaturePlanRevision !== undefined && message.graphicsFeaturePlanRevision !== plan.revision) {
		await provider.postMessageToWebview({
			type: "graphicsFeaturePlanConflict",
			graphicsFeaturePlan: plan,
			graphicsFeaturePlanError: "The plan changed before this decision edit was applied.",
		})
		return
	}
	const updatedPlan: GraphicsFeaturePlan = {
		...plan,
		revision: plan.revision + 1,
		source: "manual",
		updatedAt: new Date().toISOString(),
		decision: {
			...plan.decision,
			...(rationale !== undefined ? { rationale: rationale.map((item) => item.trim()).filter(Boolean) } : {}),
			...(alternatives !== undefined
				? {
						alternatives: alternatives
							.map((alternative) => ({
								level: alternative.level.trim(),
								reasonNotSelected: alternative.reasonNotSelected.trim(),
							}))
							.filter(
								(
									alternative,
								): alternative is {
									level: GraphicsFeaturePlan["decision"]["recommendedLevel"]
									reasonNotSelected: string
								} =>
									isGraphicsSolutionLevel(alternative.level) &&
									Boolean(alternative.reasonNotSelected),
							),
					}
				: {}),
		},
	}
	if (!(await persistGraphicsFeaturePlanEdit(provider, updatedPlan, snapshot))) return
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

/**
 * Validates and persists the editable planning-context sections as one atomic plan revision.
 * Keeping these related fields in one message prevents partial updates from mixing revisions.
 */
async function handleUpdateGraphicsFeaturePlanContext(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const snapshot = await loadGraphicsFeaturePlanSnapshot(provider)
	const plan = snapshot?.value ?? (await loadGraphicsFeaturePlan(provider))
	const projectContext = message.graphicsFeatureProjectContext
	const openQuestions = message.graphicsFeatureOpenQuestions
	const risks = message.graphicsFeatureRisks
	const acceptancePlan = message.graphicsFeatureAcceptancePlan

	if (
		!plan ||
		plan.version !== 1 ||
		(projectContext === undefined &&
			openQuestions === undefined &&
			risks === undefined &&
			acceptancePlan === undefined)
	) {
		provider.log("[Graphics] updateGraphicsFeaturePlanContext: missing or invalid fields")
		return
	}
	if (message.graphicsFeaturePlanRevision !== undefined && message.graphicsFeaturePlanRevision !== plan.revision) {
		await provider.postMessageToWebview({
			type: "graphicsFeaturePlanConflict",
			graphicsFeaturePlan: plan,
			graphicsFeaturePlanError: "The plan changed before this context edit was applied.",
		})
		return
	}

	const normalizeList = (items: string[]) => items.map((item) => item.trim()).filter(Boolean)
	const updatedPlan: GraphicsFeaturePlan = {
		...plan,
		revision: plan.revision + 1,
		source: "manual",
		updatedAt: new Date().toISOString(),
		...(projectContext !== undefined ? { projectContext: normalizeList(projectContext) } : {}),
		...(openQuestions !== undefined ? { openQuestions: normalizeList(openQuestions) } : {}),
		...(risks !== undefined
			? {
					risks: risks
						.map((risk) => ({
							...risk,
							id: risk.id.trim(),
							title: risk.title.trim(),
							mitigation: risk.mitigation.trim(),
							reviewGate: risk.reviewGate?.trim() || undefined,
						}))
						.filter(
							(risk) =>
								Boolean(risk.id && risk.title && risk.mitigation) &&
								isGraphicsFeatureRiskImpact(risk.impact),
						),
				}
			: {}),
		...(acceptancePlan !== undefined
			? {
					acceptancePlan: acceptancePlan
						.map((check) => ({
							...check,
							id: check.id.trim(),
							criterion: check.criterion.trim(),
						}))
						.filter(
							(check) =>
								Boolean(check.id && check.criterion) &&
								isGraphicsFeatureAcceptanceDimension(check.dimension) &&
								isGraphicsFeatureAcceptanceEvidence(check.evidence),
						),
				}
			: {}),
	}
	if (!(await persistGraphicsFeaturePlanEdit(provider, updatedPlan, snapshot))) return
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

/** Persists compatibility rows while preserving unrelated plan sections and the optimistic revision contract. */
async function handleUpdateGraphicsFeatureCompatibility(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const snapshot = await loadGraphicsFeaturePlanSnapshot(provider)
	const plan = snapshot?.value ?? (await loadGraphicsFeaturePlan(provider))
	const compatibility = message.graphicsFeatureCompatibility
	if (!plan || plan.version !== 1 || compatibility === undefined) {
		provider.log("[Graphics] updateGraphicsFeatureCompatibility: missing or invalid fields")
		return
	}
	if (message.graphicsFeaturePlanRevision !== undefined && message.graphicsFeaturePlanRevision !== plan.revision) {
		await provider.postMessageToWebview({
			type: "graphicsFeaturePlanConflict",
			graphicsFeaturePlan: plan,
			graphicsFeaturePlanError: "The plan changed before this compatibility edit was applied.",
		})
		return
	}
	const updatedPlan: GraphicsFeaturePlan = {
		...plan,
		revision: plan.revision + 1,
		source: "manual",
		updatedAt: new Date().toISOString(),
		compatibility: compatibility
			.map((target) => ({
				target: target.target.trim(),
				strategy: target.strategy.trim(),
				fallback: target.fallback.trim(),
			}))
			.filter((target) => target.target && target.strategy && target.fallback),
	}
	if (!(await persistGraphicsFeaturePlanEdit(provider, updatedPlan, snapshot))) return
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

/**
 * Handle runGraphicsWorkflow message.
 */
async function handleRunGraphicsWorkflow(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const intent = message.graphicsIntent as GraphicsIntent | undefined
	const userMessage = message.text ?? ""
	const orchestration = orchestrateGraphicsKnowledge(userMessage, "graphics")
	const knowledgeContext = buildGraphicsContextBlock(userMessage, "graphics")
	const enrichedUserMessage = knowledgeContext ? `${knowledgeContext}\n\n${userMessage}` : userMessage

	if (!intent) {
		provider.log("[Graphics] runGraphicsWorkflow: missing intent")
		return
	}

	provider.log(`[Graphics] Running workflow: ${intent}`)

	// Notify webview that analysis is starting
	await provider.postMessageToWebview({
		type: "graphicsWorkflowStarted",
		graphicsIntent: intent,
		requestId: message.requestId,
	})

	const operationId = message.graphicsOperationId ?? message.requestId
	const controller = new AbortController()
	if (operationId) graphicsOperationControllers.set(operationId, controller)
	const postOperationProgress = (stage: string, completedStages: string[]) => {
		void provider.postMessageToWebview({
			type: "graphicsOperationProgress",
			requestId: message.requestId,
			values: { operationId, stage, completedStages },
		} as any)
	}

	try {
		const orchestrator = getGraphicsOrchestrator(provider)
		const workspacePath = provider.cwd
		const profileStore = new GraphicsLaunchProfileStore(workspacePath, (entry) => provider.log(entry))
		const profile = message.graphicsProfileId
			? (await profileStore.listProfiles()).find((candidate) => candidate.id === message.graphicsProfileId)
			: message.graphicsProfile
		const session = message.graphicsSessionId ? await profileStore.loadSession(message.graphicsSessionId) : undefined
		const workflow = intent === "launch_and_capture"
			? new LaunchAndCaptureWorkflow(profile, profileStore)
			: intent === "recapture_validation"
				? new ValidateGraphicsFixWorkflow(
					message.graphicsCaptureArtifact ?? session?.baselineCapture,
					undefined,
					profile,
					profileStore,
				)
				: undefined
		if (workflow) orchestrator.registerWorkflow(workflow)
		postOperationProgress("started", [])
		const result = await orchestrator.execute({
			intent,
			userMessage: enrichedUserMessage,
			eventId: message.graphicsEventId === undefined ? undefined : Number(message.graphicsEventId),
			eventIdA: message.graphicsEventIdA === undefined ? undefined : Number(message.graphicsEventIdA),
			eventIdB: message.graphicsEventIdB === undefined ? undefined : Number(message.graphicsEventIdB),
			resourceId: message.graphicsResourceId,
			shaderStage: message.graphicsShaderStage,
			mappingKind: message.graphicsMappingKind,
			mappingIdentifier: message.graphicsMappingIdentifier,
			graphicsProfileId: message.graphicsProfileId,
			graphicsSessionId: message.graphicsSessionId,
			graphicsOperationId: message.graphicsOperationId ?? operationId,
			timeoutMs: message.graphicsTimeoutMs,
			signal: controller.signal,
			requestId: message.requestId,
		})

		// Get provider info for the result
		const registry = getGraphicsRegistry(provider)
		const selectedProvider = await registry.getSelectedProvider()

		result.intent = intent
		result.providerId = selectedProvider?.id
		if (result.success && (intent === "launch_and_capture" || intent === "recapture_validation")) {
			const invalidated = graphicsRuntimeCache.invalidate((key) =>
				key.includes("captureIdentity=") ||
				(message.graphicsSessionId ? key.includes(`sessionId=${message.graphicsSessionId}`) : false),
			)
			if (invalidated > 0) {
				result.evidence.push({
					source: "cacheInvalidation",
					description: `Invalidated ${invalidated} cached graphics diagnostic result(s) after capture state changed.`,
					value: { invalidated, revision: graphicsRuntimeCache.currentRevision },
				})
			}
		}
		await provider.postMessageToWebview({
			type: "graphicsResult",
			graphicsIntent: intent,
			requestId: message.requestId,
			values: {
				result,
				knowledge: {
					reasoning: orchestration.reasoning,
					recommendedSkillIds: orchestration.recommendedSkillIds,
					recommendedPlaybookId: orchestration.recommendedPlaybookId,
					hasKnowledgeInjection: orchestration.hasKnowledgeInjection,
					knowledgeIds: orchestration.knowledgeEntries.map((entry) => entry.id),
				},
				providerId: selectedProvider?.id ?? "unknown",
				providerName: selectedProvider?.displayName ?? "Unknown Provider",
				timestamp: Date.now(),
			},
		} as any)

		if (result.success && (result.suspectedIssues.length > 0 || result.suggestions.length > 0)) {
			captureKnowledge({
				title: `graphics-workflow-${intent}-${Date.now()}`,
				kind: "case-study",
				tags: ["graphics", "workflow", intent],
				triggers: [intent, ...orchestration.knowledgeEntries.flatMap((entry) => entry.triggers).slice(0, 8)],
				scenarios: [intent],
				summary: result.summary,
				relatedSkills: orchestration.recommendedSkillIds,
				relatedPlaybooks: orchestration.recommendedPlaybookId ? [orchestration.recommendedPlaybookId] : [],
				sourceContext: `workflow:${intent}`,
				content: buildCaptureContent({
					title: `Graphics Workflow: ${intent}`,
					findings: result.evidence.map((item) => item.description),
					rootCause: result.suspectedIssues[0]?.description,
					recommendations: result.suggestions,
					relatedKnowledgeIds: orchestration.knowledgeEntries.map((entry) => entry.id),
				}),
			})
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`[Graphics] Workflow error: ${errorMessage}`)

		await provider.postMessageToWebview({
			type: "graphicsResult",
			graphicsIntent: intent,
			requestId: message.requestId,
			values: {
				result: {
					success: false,
					summary: `Workflow failed: ${errorMessage}`,
					evidence: [],
					suspectedIssues: [],
					suggestions: [],
					error: errorMessage,
				},
				providerId: "unknown",
				providerName: "Unknown",
				timestamp: Date.now(),
			},
		} as any)
	} finally {
		if (operationId && graphicsOperationControllers.get(operationId) === controller) {
			graphicsOperationControllers.delete(operationId)
		}
	}
}

/**
 * Handle runGraphicsPlaybook message.
 */
async function handleRunGraphicsPlaybook(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const playbookId = message.graphicsPlaybookId as GraphicsPlaybookId | undefined
	const userMessage = message.text ?? ""
	const orchestration = orchestrateGraphicsKnowledge(userMessage, "graphics")
	const knowledgeContext = buildGraphicsContextBlock(userMessage, "graphics")
	const enrichedUserMessage = knowledgeContext ? `${knowledgeContext}\n\n${userMessage}` : userMessage

	// If no playbook ID specified, try to detect from message
	const resolvedPlaybookId =
		playbookId ??
		(orchestration.recommendedPlaybookId as GraphicsPlaybookId | undefined) ??
		detectPlaybookFromMessage(userMessage)

	if (!resolvedPlaybookId) {
		provider.log("[Graphics] runGraphicsPlaybook: missing playbook ID")
		return
	}

	provider.log(`[Graphics] Running playbook: ${resolvedPlaybookId}`)

	// Notify webview that analysis is starting
	await provider.postMessageToWebview({
		type: "graphicsWorkflowStarted",
		graphicsPlaybookId: resolvedPlaybookId,
	} as any)

	try {
		const registry = getGraphicsRegistry(provider)

		// Get playbook to check required capabilities
		const playbook = getPlaybook(resolvedPlaybookId)
		if (!playbook) {
			throw new Error(`Playbook not found: ${resolvedPlaybookId}`)
		}

		// Perform capability preflight check
		const requiredCaps = playbook.requiredCapabilities.reduce(
			(acc: Partial<GraphicsProviderCapabilities>, cap: string) => {
				acc[cap as keyof GraphicsProviderCapabilities] = true
				return acc
			},
			{} as Partial<GraphicsProviderCapabilities>,
		)

		const selectedProvider = await registry.preflightCheck(requiredCaps)

		const result = await runPlaybook(resolvedPlaybookId, selectedProvider, enrichedUserMessage)

		await provider.postMessageToWebview({
			type: "graphicsResult",
			graphicsPlaybookId: resolvedPlaybookId,
			values: {
				result,
				knowledge: {
					reasoning: orchestration.reasoning,
					recommendedSkillIds: orchestration.recommendedSkillIds,
					recommendedPlaybookId: orchestration.recommendedPlaybookId,
					hasKnowledgeInjection: orchestration.hasKnowledgeInjection,
					knowledgeIds: orchestration.knowledgeEntries.map((entry) => entry.id),
				},
				providerId: selectedProvider.id,
				providerName: selectedProvider.displayName,
				timestamp: Date.now(),
			},
		} as any)

		if (result.success && (result.suspectedIssues.length > 0 || result.suggestions.length > 0)) {
			captureKnowledge({
				title: `graphics-playbook-${resolvedPlaybookId}-${Date.now()}`,
				kind: "case-study",
				tags: ["graphics", "playbook", resolvedPlaybookId],
				triggers: [
					resolvedPlaybookId,
					...orchestration.knowledgeEntries.flatMap((entry) => entry.triggers).slice(0, 8),
				],
				scenarios: ["graphics_playbook"],
				summary: result.summary,
				relatedSkills: orchestration.recommendedSkillIds,
				relatedPlaybooks: [resolvedPlaybookId],
				sourceContext: `playbook:${resolvedPlaybookId}`,
				content: buildCaptureContent({
					title: `Graphics Playbook: ${resolvedPlaybookId}`,
					findings: result.evidence.map((item) => item.description),
					rootCause: result.suspectedIssues[0]?.description,
					recommendations: result.suggestions,
					relatedKnowledgeIds: orchestration.knowledgeEntries.map((entry) => entry.id),
				}),
			})
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`[Graphics] Playbook error: ${errorMessage}`)

		await provider.postMessageToWebview({
			type: "graphicsResult",
			graphicsPlaybookId: resolvedPlaybookId,
			values: {
				result: {
					success: false,
					summary: `Playbook failed: ${errorMessage}`,
					evidence: [],
					suspectedIssues: [],
					suggestions: [],
					error: errorMessage,
				},
				providerId: "unknown",
				providerName: "Unknown",
				timestamp: Date.now(),
			},
		} as any)
	}
}

/**
 * Handle selectGraphicsProvider message.
 */
async function handleSelectGraphicsProvider(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const providerId = message.graphicsProviderId

	if (!providerId) {
		provider.log("[Graphics] selectGraphicsProvider: missing provider ID")
		return
	}

	provider.log(`[Graphics] Selecting provider: ${providerId}`)

	try {
		const registry = getGraphicsRegistry(provider)
		await registry.selectProvider(providerId)

		// Notify webview of successful selection
		const selectedProvider = await registry.getSelectedProvider()
		await provider.postMessageToWebview({
			type: "graphicsProviderSelected",
			values: {
				providerId: selectedProvider?.id,
				providerName: selectedProvider?.displayName,
			},
		} as any)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`[Graphics] Provider selection error: ${errorMessage}`)
	}
}

async function handleRequestGraphicsCaptureStatus(provider: ClineProvider): Promise<void> {
	try {
		const registry = getGraphicsRegistry(provider)
		const selected = await registry.getSelectedProvider()
		const statuses = await registry.getAllStatuses()
		const status = selected
			? statuses.find((candidate) => candidate.providerId === selected.id)
			: statuses[0]

		await provider.postMessageToWebview({
			type: "graphicsCaptureStatus",
			graphicsCaptureStatus: {
				status: status?.status ?? "unavailable",
				providerId: status?.providerId,
				providerName: status?.providerName,
				message: status?.message ?? "No runtime capture provider is available.",
				refreshedAt: new Date().toISOString(),
			},
		} as any)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		await provider.postMessageToWebview({
			type: "graphicsCaptureStatus",
			graphicsCaptureStatus: {
				status: "error",
				message,
				refreshedAt: new Date().toISOString(),
			},
		} as any)
	}
}

async function handleRequestGraphicsFrameSummary(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const selected = await getGraphicsCaptureProvider(provider)
	const result = selected
		? await selected.getFrameSummary()
		: { success: false, error: "No runtime capture provider is available." }
	await provider.postMessageToWebview({
		type: "graphicsFrameSummary",
		graphicsFrameSummary: {
			success: result.success,
			data: result,
			error: result.error,
		},
		requestId: message.requestId,
	} as any)
}

async function handleRequestGraphicsSelectionContext(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const selected = await getGraphicsCaptureProvider(provider)
	const result = selected
		? await selected.getSelectionContext()
		: { success: false, error: "No runtime capture provider is available." }
	await provider.postMessageToWebview({
		type: "graphicsSelectionContext",
		graphicsSelectionContext: {
			success: result.success,
			data: result,
			error: result.error,
		},
		requestId: message.requestId,
	} as any)
}

async function handleRequestGraphicsEventDetails(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const selected = await getGraphicsCaptureProvider(provider)
	const eventId = message.graphicsEventId
	const result = selected && eventId !== undefined
		? await selected.getEventDetails(eventId)
		: { success: false, error: eventId === undefined ? "Event ID is required." : "No runtime capture provider is available." }
	await provider.postMessageToWebview({
		type: "graphicsEventDetails",
		graphicsEventDetails: {
			success: result.success,
			data: result,
			error: result.error,
		},
		requestId: message.requestId,
	} as any)
}

async function handleRequestGraphicsPipelineState(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const selected = await getGraphicsCaptureProvider(provider)
	const eventId = message.graphicsEventId
	const result = selected && eventId !== undefined
		? await selected.getPipelineState(eventId)
		: { success: false, error: eventId === undefined ? "Event ID is required." : "No runtime capture provider is available." }
	await provider.postMessageToWebview({
		type: "graphicsPipelineState",
		graphicsPipelineState: {
			success: result.success,
			data: result,
			error: result.error,
		},
		requestId: message.requestId,
	} as any)
}

async function handleRequestGraphicsShaderInfo(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const selected = await getGraphicsCaptureProvider(provider)
	const eventId = message.graphicsEventId
	const result = selected && eventId !== undefined
		? await selected.getShaderInfo({ eventId, stage: message.graphicsShaderStage })
		: { success: false, error: eventId === undefined ? "Event ID is required." : "No runtime capture provider is available." }
	await provider.postMessageToWebview({
		type: "graphicsShaderInfo",
		graphicsShaderInfo: {
			success: result.success,
			data: result,
			error: result.error,
		},
		requestId: message.requestId,
	} as any)
}

async function getGraphicsCaptureProvider(provider: ClineProvider) {
	const registry = getGraphicsRegistry(provider)
	return (await registry.getSelectedProvider()) ?? (await registry.getAvailableProviders())[0] ?? null
}

async function handleRequestGraphicsAssetProviderStatus(provider: ClineProvider): Promise<void> {
	const registry = getGraphicsAssetRegistry(provider)
	const statuses = await registry.getAllStatuses()
	const status = statuses[0]
	const capabilities = status ? await registry.getCapabilities(status.providerId) : null
	await getGraphicsAssetCapabilities(provider)
	await provider.postMessageToWebview({
		type: "graphicsAssetProviderStatus",
		graphicsAssetProviderStatus: status
			? {
					...status,
					capabilities: capabilities
						? Object.fromEntries(Object.entries(capabilities))
						: {},
				}
			: undefined,
	} as any)
}

async function handleLoadGraphicsAssetArtifact(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const assetProvider = getGraphicsAssetRegistry(provider).getProvider()
	const result = assetProvider
		? await assetProvider.loadArtifact(message.graphicsAssetPath ?? "", message.graphicsAssetKind)
		: { success: false, error: "AssetStudio provider is unavailable." }
	await provider.postMessageToWebview({
		type: "graphicsAssetArtifactLoaded",
		graphicsAssetArtifactLoaded: result,
		requestId: message.requestId,
	} as any)
}

async function handleRequestGraphicsAssetInventory(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const assetProvider = getGraphicsAssetRegistry(provider).getProvider()
	const result = assetProvider
		? await assetProvider.getAssetInventory(message.graphicsAssetArtifactId)
		: { success: false, error: "AssetStudio provider is unavailable." }
	await provider.postMessageToWebview({
		type: "graphicsAssetInventory",
		graphicsAssetInventory: result,
		requestId: message.requestId,
	} as any)
}

/**
 * Handle requestGraphicsProviderStatus message.
 */
async function handleRequestGraphicsProviderStatus(provider: ClineProvider): Promise<void> {
	try {
		const registry = getGraphicsRegistry(provider)
		const allProviders = await registry.listProviders()
		const [statuses, selectedProvider, capabilitiesEntries] = await Promise.all([
			registry.getAllStatuses(),
			registry.getSelectedProvider(),
			Promise.all(
				allProviders.map(async (graphicsProvider) => {
					try {
						const capabilities = await graphicsProvider.getCapabilities()
						return [graphicsProvider.id, capabilities] as const
					} catch {
						return [graphicsProvider.id, null] as const
					}
				}),
			),
		])

		const capabilitiesByProviderId = Object.fromEntries(capabilitiesEntries)

		await provider.postMessageToWebview({
			type: "graphicsProviderStatus",
			values: {
				providers: statuses,
				selectedProviderId: selectedProvider?.id,
				capabilitiesByProviderId,
			},
		} as any)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`[Graphics] Status request error: ${errorMessage}`)
	}
}
