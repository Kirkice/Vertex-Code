/**
 * Graphics Message Handler
 *
 * Handles webview messages related to the graphics agent.
 * Routes messages to the appropriate graphics workflow or playbook.
 *
 * @module webview/graphicsMessageHandler
 */

import type {
	GraphicsFeatureBrief,
	GraphicsFeaturePlan,
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

		default:
			return false
	}
}

async function handleRequestGraphicsFeatureBrief(provider: ClineProvider): Promise<void> {
	const graphicsFeatureBrief = provider.context.workspaceState.get<GraphicsFeatureBrief>(
		GRAPHICS_FEATURE_BRIEF_WORKSPACE_KEY,
	)
	await provider.postMessageToWebview({ type: "graphicsFeatureBrief", graphicsFeatureBrief })
}

async function handleSaveGraphicsFeatureBrief(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	if (!message.graphicsFeatureBrief || message.graphicsFeatureBrief.version !== 1) {
		provider.log("[Graphics] saveGraphicsFeatureBrief: missing or unsupported brief")
		return
	}

	await provider.context.workspaceState.update(GRAPHICS_FEATURE_BRIEF_WORKSPACE_KEY, message.graphicsFeatureBrief)
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
	await provider.context.workspaceState.update(GRAPHICS_FEATURE_PLAN_WORKSPACE_KEY, graphicsFeaturePlan)
	await provider.postMessageToWebview({ type: "graphicsFeaturePlan", graphicsFeaturePlan })
}

async function handleRequestGraphicsFeaturePlanRecovery(provider: ClineProvider): Promise<void> {
	const graphicsFeaturePlan = provider.context.workspaceState.get<GraphicsFeaturePlan>(
		GRAPHICS_FEATURE_PLAN_WORKSPACE_KEY,
	)
	await provider.postMessageToWebview({
		type: "graphicsFeaturePlanRecovered",
		graphicsFeaturePlan,
	})
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
	const plan = provider.context.workspaceState.get<GraphicsFeaturePlan>(GRAPHICS_FEATURE_PLAN_WORKSPACE_KEY)

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
	await provider.context.workspaceState.update(GRAPHICS_FEATURE_PLAN_WORKSPACE_KEY, updatedPlan)
	await provider.postMessageToWebview({ type: "graphicsFeaturePlanUpdated", graphicsFeaturePlan: updatedPlan })
}

async function handleUpdateGraphicsFeatureTask(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const taskId = message.graphicsFeatureTaskId
	const title = message.graphicsFeatureTaskTitle?.trim()
	const completionConditions = message.graphicsFeatureTaskCompletionConditions
	const plan = provider.context.workspaceState.get<GraphicsFeaturePlan>(GRAPHICS_FEATURE_PLAN_WORKSPACE_KEY)

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
	await provider.context.workspaceState.update(GRAPHICS_FEATURE_PLAN_WORKSPACE_KEY, updatedPlan)
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
