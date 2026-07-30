/**
 * Graphics Message Handler
 *
 * Handles webview messages related to the graphics agent.
 * Routes messages to the appropriate graphics workflow or playbook.
 *
 * @module webview/graphicsMessageHandler
 */

import type {
	GraphicsFeatureAcceptanceCheck,
	GraphicsFeatureBrief,
	GraphicsFeaturePlan,
	GraphicsFeatureRisk,
	GraphicsFeatureTaskStatus,
	GraphicsIntent,
	GraphicsPlaybookId,
	WebviewMessage,
} from "@roo-code/types"
import type { ClineProvider } from "./ClineProvider"
import { GraphicsProviderRegistry } from "../../services/graphics-provider/GraphicsProviderRegistry"
import { GraphicsWorkflowOrchestrator } from "../../services/graphics-agent/GraphicsWorkflowOrchestrator"
import { RenderDocVsCodeMcpProvider } from "../../services/graphics-provider/providers/renderdoc-vscode-mcp/RenderDocVsCodeMcpProvider"
import { AnalyzeCurrentFrameWorkflow } from "../../services/graphics-agent/workflows/analyzeCurrentFrame"
import { ExplainSelectedDrawWorkflow } from "../../services/graphics-agent/workflows/explainSelectedDraw"
import { FindOwnerInProjectWorkflow } from "../../services/graphics-agent/workflows/findOwnerInProject"
import {
	runPlaybook,
	detectPlaybookFromMessage,
	getPlaybook,
} from "../../services/graphics-agent/playbooks/playbookRunner"
import { createGraphicsFeaturePlan } from "../../services/graphics-agent/planning/GraphicsFeaturePlanner"
import { profileGraphicsProject } from "../../services/graphics-agent/planning/GraphicsProjectProfiler"
import { selectGraphicsSolution } from "../../services/graphics-agent/planning/GraphicsSolutionSelector"
import { GraphicsFeatureWorkspaceStore } from "../../services/graphics-agent/persistence/GraphicsFeatureWorkspaceStore"
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
let graphicsOrchestrator: GraphicsWorkflowOrchestrator | null = null
const GRAPHICS_FEATURE_BRIEF_WORKSPACE_KEY = "graphicsFeatureBrief"
const GRAPHICS_FEATURE_PLAN_WORKSPACE_KEY = "graphicsFeaturePlan"

/** Creates the project-file store per request so tests and multiple workspaces never share path state. */
function getGraphicsFeatureWorkspaceStore(provider: ClineProvider): GraphicsFeatureWorkspaceStore {
	return new GraphicsFeatureWorkspaceStore(provider.cwd, (message) => provider.log(message))
}

/** Reads the project file first and falls back to workspaceState for legacy and no-workspace sessions. */
async function loadGraphicsFeatureBrief(provider: ClineProvider): Promise<GraphicsFeatureBrief | undefined> {
	const projectBrief = await getGraphicsFeatureWorkspaceStore(provider).loadBrief()
	return (
		projectBrief ?? provider.context.workspaceState.get<GraphicsFeatureBrief>(GRAPHICS_FEATURE_BRIEF_WORKSPACE_KEY)
	)
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

/** Keeps workspaceState warm while atomically publishing the same revision to the project file. */
async function saveGraphicsFeaturePlan(provider: ClineProvider, plan: GraphicsFeaturePlan): Promise<void> {
	await provider.context.workspaceState.update(GRAPHICS_FEATURE_PLAN_WORKSPACE_KEY, plan)
	await getGraphicsFeatureWorkspaceStore(provider).savePlan(plan)
}

/**
 * Get or create the graphics provider registry.
 */
function getGraphicsRegistry(provider: ClineProvider): GraphicsProviderRegistry {
	if (!graphicsRegistry) {
		graphicsRegistry = new GraphicsProviderRegistry()

		// Register the RenderDoc VS Code MCP provider if McpHub is available
		const mcpHub = (provider as any).mcpHub
		if (mcpHub) {
			const renderDocProvider = new RenderDocVsCodeMcpProvider(mcpHub)
			graphicsRegistry.registerProvider(renderDocProvider)
		}
	}
	return graphicsRegistry
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
export async function handleGraphicsMessage(provider: ClineProvider, message: WebviewMessage): Promise<boolean> {
	switch (message.type) {
		case "runGraphicsWorkflow":
			await handleRunGraphicsWorkflow(provider, message)
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

		case "updateGraphicsFeatureTaskStatus":
			await handleUpdateGraphicsFeatureTaskStatus(provider, message)
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
	const graphicsProjectProfile = await profileGraphicsProject(provider.cwd)
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

	const graphicsProjectProfile = await profileGraphicsProject(provider.cwd)
	const graphicsSolutionRecommendation = selectGraphicsSolution(message.graphicsFeatureBrief, graphicsProjectProfile)
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

	const graphicsProjectProfile = await profileGraphicsProject(provider.cwd)
	const graphicsSolutionRecommendation = selectGraphicsSolution(message.graphicsFeatureBrief, graphicsProjectProfile)
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
	await provider.postMessageToWebview({
		type: "graphicsFeaturePlanRecovered",
		graphicsFeaturePlan,
	})
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
	const plan = await loadGraphicsFeaturePlan(provider)

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
	await saveGraphicsFeaturePlan(provider, updatedPlan)
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanUpdated", graphicsFeaturePlan: updatedPlan })
}

async function handleUpdateGraphicsFeatureTask(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const taskId = message.graphicsFeatureTaskId
	const title = message.graphicsFeatureTaskTitle?.trim()
	const completionConditions = message.graphicsFeatureTaskCompletionConditions
	const plan = await loadGraphicsFeaturePlan(provider)

	if (!plan || plan.version !== 1 || !taskId || (!title && !completionConditions)) {
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
	await saveGraphicsFeaturePlan(provider, updatedPlan)
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

async function handleUpdateGraphicsFeaturePlan(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const plan = await loadGraphicsFeaturePlan(provider)
	const title = message.graphicsFeaturePlanTitle?.trim()
	const briefSummary = message.graphicsFeaturePlanBriefSummary?.trim()

	if (!plan || plan.version !== 1 || (title === undefined && briefSummary === undefined)) {
		provider.log("[Graphics] updateGraphicsFeaturePlan: missing or invalid plan fields")
		return
	}
	if (message.graphicsFeaturePlanRevision !== undefined && message.graphicsFeaturePlanRevision !== plan.revision) {
		await provider.postMessageToWebview({
			type: "graphicsFeaturePlanConflict",
			graphicsFeaturePlan: plan,
			graphicsFeaturePlanError: "The plan changed before this edit was applied.",
		})
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
	await saveGraphicsFeaturePlan(provider, updatedPlan)
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

async function handleUpdateGraphicsFeaturePlanSection(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const plan = await loadGraphicsFeaturePlan(provider)
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
	await saveGraphicsFeaturePlan(provider, updatedPlan)
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

async function handleUpdateGraphicsFeatureAssetContract(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const plan = await loadGraphicsFeaturePlan(provider)
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
	await saveGraphicsFeaturePlan(provider, updatedPlan)
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

async function handleUpdateGraphicsFeaturePerformanceBudget(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const plan = await loadGraphicsFeaturePlan(provider)
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
	await saveGraphicsFeaturePlan(provider, updatedPlan)
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

async function handleUpdateGraphicsFeatureDecision(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const plan = await loadGraphicsFeaturePlan(provider)
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
	await saveGraphicsFeaturePlan(provider, updatedPlan)
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

/**
 * Validates and persists the editable planning-context sections as one atomic plan revision.
 * Keeping these related fields in one message prevents partial updates from mixing revisions.
 */
async function handleUpdateGraphicsFeaturePlanContext(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const plan = await loadGraphicsFeaturePlan(provider)
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
	await saveGraphicsFeaturePlan(provider, updatedPlan)
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanEdited", graphicsFeaturePlan: updatedPlan })
}

/** Persists compatibility rows while preserving unrelated plan sections and the optimistic revision contract. */
async function handleUpdateGraphicsFeatureCompatibility(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const plan = await loadGraphicsFeaturePlan(provider)
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
	await saveGraphicsFeaturePlan(provider, updatedPlan)
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
	} as any)

	try {
		const orchestrator = getGraphicsOrchestrator(provider)
		const result = await orchestrator.execute({
			intent,
			userMessage: enrichedUserMessage,
		})

		// Get provider info for the result
		const registry = getGraphicsRegistry(provider)
		const selectedProvider = await registry.getSelectedProvider()

		await provider.postMessageToWebview({
			type: "graphicsResult",
			graphicsIntent: intent,
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
