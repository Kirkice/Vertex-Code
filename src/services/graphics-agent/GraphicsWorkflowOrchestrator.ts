/**
 * Graphics Workflow Orchestrator
 *
 * Central coordinator for graphics analysis workflows.
 * Routes requests to appropriate workflows based on intent,
 * manages provider selection, and returns structured results.
 *
 * Responsibilities:
 * - Select appropriate workflow based on intent
 * - Perform capability preflight checks
 * - Execute workflow with selected provider
 * - Return structured results
 *
 * @module graphics-agent/GraphicsWorkflowOrchestrator
 */

import type { GraphicsCaptureProvider } from "../graphics-provider/GraphicsCaptureProvider"
import type {
	GraphicsIntent,
	GraphicsWorkflowRequest,
	GraphicsWorkflowResult,
	GraphicsProviderCapabilities,
} from "../graphics-provider/GraphicsProviderTypes"
import type { IGraphicsProviderRegistry } from "../graphics-provider/GraphicsProviderRegistry"
import { GraphicsProviderError } from "../graphics-provider/GraphicsProviderError"

/**
 * Interface for a graphics workflow implementation.
 * Each workflow handles a specific type of graphics analysis.
 */
export interface GraphicsWorkflow {
	/** The intent this workflow handles */
	readonly intent: GraphicsIntent

	/** Required capabilities for this workflow */
	readonly requiredCapabilities: Partial<GraphicsProviderCapabilities>

	/**
	 * Execute the workflow with the given provider.
	 *
	 * @param provider - The graphics provider to use
	 * @param request - The workflow request parameters
	 * @returns Structured workflow result
	 */
	execute(
		provider: GraphicsCaptureProvider,
		request: GraphicsWorkflowRequest,
	): Promise<GraphicsWorkflowResult>
}

/**
 * Orchestrator for graphics analysis workflows.
 */
export class GraphicsWorkflowOrchestrator {
	private workflows = new Map<GraphicsIntent, GraphicsWorkflow>()

	constructor(private readonly registry: IGraphicsProviderRegistry) {}

	/**
	 * Register a workflow implementation.
	 *
	 * @param workflow - The workflow to register
	 */
	registerWorkflow(workflow: GraphicsWorkflow): void {
		this.workflows.set(workflow.intent, workflow)
	}

	/**
	 * Unregister a workflow by intent.
	 *
	 * @param intent - The intent to unregister
	 */
	unregisterWorkflow(intent: GraphicsIntent): void {
		this.workflows.delete(intent)
	}

	/**
	 * Execute a graphics workflow request.
	 *
	 * This method:
	 * 1. Finds the appropriate workflow for the intent
	 * 2. Performs capability preflight check
	 * 3. Executes the workflow with the selected provider
	 * 4. Returns structured results
	 *
	 * @param request - The workflow request
	 * @returns Structured workflow result
	 * @throws GraphicsProviderError if no suitable provider or workflow is found
	 */
	async execute(request: GraphicsWorkflowRequest): Promise<GraphicsWorkflowResult> {
		// Find workflow for this intent
		const workflow = this.workflows.get(request.intent)
		if (!workflow) {
			return {
				success: false,
				summary: `No workflow registered for intent: ${request.intent}`,
				evidence: [],
				suspectedIssues: [],
				suggestions: [],
				error: `Workflow not found for intent: ${request.intent}`,
			}
		}

		// Perform preflight check to get a suitable provider
		let provider: GraphicsCaptureProvider
		try {
			provider = await this.registry.preflightCheck(workflow.requiredCapabilities)
		} catch (error) {
			if (error instanceof GraphicsProviderError) {
				return {
					success: false,
					summary: error.getUserMessage(),
					evidence: [],
					suspectedIssues: [],
					suggestions: this.getSuggestionsForError(error.code),
					error: error.message,
				}
			}
			throw error
		}

		// Execute the workflow
		try {
			return await workflow.execute(provider, request)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			return {
				success: false,
				summary: `Workflow execution failed: ${message}`,
				evidence: [],
				suspectedIssues: [],
				suggestions: ["Please try again or check the graphics provider status."],
				error: message,
			}
		}
	}

	/**
	 * Get available workflow intents.
	 *
	 * @returns List of registered workflow intents
	 */
	getAvailableIntents(): GraphicsIntent[] {
		return Array.from(this.workflows.keys())
	}

	/**
	 * Check if a workflow is registered for the given intent.
	 *
	 * @param intent - The intent to check
	 * @returns True if a workflow is registered
	 */
	hasWorkflow(intent: GraphicsIntent): boolean {
		return this.workflows.has(intent)
	}

	/**
	 * Get suggestions based on error codes.
	 */
	private getSuggestionsForError(code: string): string[] {
		switch (code) {
			case "PROVIDER_NOT_FOUND":
				return [
					"Please install a graphics capture tool (e.g., RenderDoc for VS Code).",
					"Check your MCP server configuration.",
				]
			case "PROVIDER_UNAVAILABLE":
				return [
					"Ensure the graphics tool is running.",
					"Check if the MCP server is started.",
				]
			case "NO_CAPTURE_OPEN":
				return [
					"Open a capture in your graphics tool first.",
					"Use the 'Open Current Capture' action.",
				]
			case "CAPABILITY_MISMATCH":
				return [
					"Try a different graphics provider that supports this operation.",
					"Check the provider's capability list.",
				]
			case "NO_SUITABLE_PROVIDER":
				return [
					"Install a graphics capture tool.",
					"Configure a graphics MCP server in your settings.",
				]
			default:
				return ["Please try again or check the graphics provider status."]
		}
	}
}
