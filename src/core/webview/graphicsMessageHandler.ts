/**
 * Graphics Message Handler
 *
 * Handles webview messages related to the graphics agent.
 * Routes messages to the appropriate graphics workflow or playbook.
 *
 * @module webview/graphicsMessageHandler
 */

import type { WebviewMessage } from "@roo-code/types"
import type { GraphicsIntent, GraphicsPlaybookId } from "@roo-code/types"
import type { ClineProvider } from "./ClineProvider"
import { GraphicsProviderRegistry } from "../../services/graphics-provider/GraphicsProviderRegistry"
import { GraphicsWorkflowOrchestrator } from "../../services/graphics-agent/GraphicsWorkflowOrchestrator"
import { RenderDocVsCodeMcpProvider } from "../../services/graphics-provider/providers/renderdoc-vscode-mcp/RenderDocVsCodeMcpProvider"
import { AnalyzeCurrentFrameWorkflow } from "../../services/graphics-agent/workflows/analyzeCurrentFrame"
import { ExplainSelectedDrawWorkflow } from "../../services/graphics-agent/workflows/explainSelectedDraw"
import { FindOwnerInProjectWorkflow } from "../../services/graphics-agent/workflows/findOwnerInProject"
import { runPlaybook, detectPlaybookFromMessage, getPlaybook } from "../../services/graphics-agent/playbooks/playbookRunner"
import type { GraphicsProviderCapabilities } from "../../services/graphics-provider/GraphicsProviderTypes"

/**
 * Singleton graphics agent instances.
 * These are lazily initialized on first use.
 */
let graphicsRegistry: GraphicsProviderRegistry | null = null
let graphicsOrchestrator: GraphicsWorkflowOrchestrator | null = null

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
export async function handleGraphicsMessage(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<boolean> {
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

		default:
			return false
	}
}

/**
 * Handle runGraphicsWorkflow message.
 */
async function handleRunGraphicsWorkflow(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const intent = message.graphicsIntent as GraphicsIntent | undefined
	const userMessage = message.text ?? ""

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
			userMessage,
		})

		// Get provider info for the result
		const registry = getGraphicsRegistry(provider)
		const selectedProvider = await registry.getSelectedProvider()

		await provider.postMessageToWebview({
			type: "graphicsResult",
			graphicsIntent: intent,
			values: {
				result,
				providerId: selectedProvider?.id ?? "unknown",
				providerName: selectedProvider?.displayName ?? "Unknown Provider",
				timestamp: Date.now(),
			},
		} as any)
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
async function handleRunGraphicsPlaybook(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
	const playbookId = message.graphicsPlaybookId as GraphicsPlaybookId | undefined
	const userMessage = message.text ?? ""

	// If no playbook ID specified, try to detect from message
	const resolvedPlaybookId = playbookId ?? detectPlaybookFromMessage(userMessage)

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
		const requiredCaps = playbook.requiredCapabilities.reduce((acc: Partial<GraphicsProviderCapabilities>, cap: string) => {
			acc[cap as keyof GraphicsProviderCapabilities] = true
			return acc
		}, {} as Partial<GraphicsProviderCapabilities>)

		const selectedProvider = await registry.preflightCheck(requiredCaps)

		const result = await runPlaybook(resolvedPlaybookId, selectedProvider, userMessage)

		await provider.postMessageToWebview({
			type: "graphicsResult",
			graphicsPlaybookId: resolvedPlaybookId,
			values: {
				result,
				providerId: selectedProvider.id,
				providerName: selectedProvider.displayName,
				timestamp: Date.now(),
			},
		} as any)
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
async function handleSelectGraphicsProvider(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<void> {
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
async function handleRequestGraphicsProviderStatus(
	provider: ClineProvider,
): Promise<void> {
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
