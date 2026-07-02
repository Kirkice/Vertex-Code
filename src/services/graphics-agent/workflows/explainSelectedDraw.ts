/**
 * Explain Selected Draw Workflow
 *
 * Handles detailed analysis of the currently selected draw call:
 * pipeline state, shader info, mesh data, and resource bindings.
 *
 * User questions this workflow handles:
 * - "解释当前 draw"
 * - "为什么这个 draw 很贵"
 * - "这个 draw 在做什么"
 *
 * @module graphics-agent/workflows/explainSelectedDraw
 */

import type { GraphicsCaptureProvider } from "../../graphics-provider/GraphicsCaptureProvider"
import type {
	GraphicsProviderCapabilities,
	GraphicsWorkflowRequest,
	GraphicsWorkflowResult,
	EvidenceItem,
	SuspectedIssue,
} from "../../graphics-provider/GraphicsProviderTypes"
import type { GraphicsWorkflow } from "../GraphicsWorkflowOrchestrator"

/**
 * Required capabilities for draw explanation.
 */
export const requiredCapabilities: Partial<GraphicsProviderCapabilities> = {
	selectionContext: true,
	eventDetails: true,
	pipelineState: true,
	shaderInfo: true,
}

/**
 * Explain Selected Draw workflow implementation.
 */
export class ExplainSelectedDrawWorkflow implements GraphicsWorkflow {
	readonly intent = "selected_draw_explain" as const
	readonly requiredCapabilities = requiredCapabilities

	async execute(
		provider: GraphicsCaptureProvider,
		request: GraphicsWorkflowRequest,
	): Promise<GraphicsWorkflowResult> {
		const evidence: EvidenceItem[] = []
		const suspectedIssues: SuspectedIssue[] = []
		const suggestions: string[] = []

		// Step 1: Get selection context
		const selection = await provider.getSelectionContext()
		if (!selection.success || selection.eventId === undefined) {
			return {
				success: false,
				summary: "No draw is currently selected",
				evidence: [],
				suspectedIssues: [],
				suggestions: [
					"Please select a draw call in the Event Browser of your graphics tool.",
					"Then ask again to analyze the selected draw.",
				],
				error: selection.error ?? "No selection context available",
			}
		}

		const eventId = request.eventId ?? selection.eventId

		evidence.push({
			source: "selectionContext",
			description: `Selected: EID ${eventId} "${selection.eventName ?? "unknown"}" in pass "${selection.passName ?? "unknown"}"`,
			value: selection,
		})

		// Step 2: Get event details
		const eventDetails = await provider.getEventDetails(eventId)
		if (eventDetails.success) {
			evidence.push({
				source: "eventDetails",
				description: this.describeEventDetails(eventDetails),
				value: eventDetails,
			})

			// Analyze event characteristics
			this.analyzeEventCharacteristics(eventDetails, suspectedIssues)
		}

		// Step 3: Get pipeline state
		const pipelineState = await provider.getPipelineState(eventId)
		if (pipelineState.success) {
			evidence.push({
				source: "pipelineState",
				description: this.describePipelineState(pipelineState),
				value: pipelineState,
			})

			// Analyze pipeline for potential issues
			this.analyzePipelineState(pipelineState, suspectedIssues)
		}

		// Step 4: Get shader info (if available)
		const caps = await provider.getCapabilities()
		if (caps.shaderInfo) {
			const shaderInfo = await provider.getShaderInfo({ eventId, stage: "pixel" })
			if (shaderInfo.success) {
				evidence.push({
					source: "shaderInfo",
					description: this.describeShaderInfo(shaderInfo),
					value: shaderInfo,
				})

				// Analyze shader complexity
				this.analyzeShaderComplexity(shaderInfo, suspectedIssues)
			}
		}

		// Step 5: Get mesh data (if available and relevant)
		if (caps.meshData) {
			// Mesh data is optional and may not be available for all draw types
			// We don't fail if it's not available
		}

		// Build summary and suggestions
		const summary = this.buildSummary(selection, eventDetails, suspectedIssues)
		this.generateSuggestions(suspectedIssues, suggestions)

		return {
			success: true,
			summary,
			evidence,
			suspectedIssues,
			suggestions,
			rawData: {
				selection,
				eventDetails,
				pipelineState,
			},
		}
	}

	/**
	 * Describe event details in human-readable form.
	 */
	private describeEventDetails(details: any): string {
		const parts: string[] = []
		if (details.durationMs !== undefined) {
			parts.push(`Duration: ${details.durationMs.toFixed(3)} ms`)
		}
		if (details.primitiveCount !== undefined) {
			parts.push(`Primitives: ${details.primitiveCount.toLocaleString()}`)
		}
		if (details.shaderStages && details.shaderStages.length > 0) {
			parts.push(`Shader stages: ${details.shaderStages.join(", ")}`)
		}
		return parts.join(", ") || "Event details retrieved"
	}

	/**
	 * Describe pipeline state in human-readable form.
	 */
	private describePipelineState(state: any): string {
		const parts: string[] = []
		if (state.renderTargets && state.renderTargets.length > 0) {
			parts.push(`${state.renderTargets.length} render target(s)`)
		}
		if (state.depthStencil) {
			parts.push("depth/stencil bound")
		}
		if (state.vertexBuffers && state.vertexBuffers.length > 0) {
			parts.push(`${state.vertexBuffers.length} vertex buffer(s)`)
		}
		return parts.join(", ") || "Pipeline state retrieved"
	}

	/**
	 * Describe shader info in human-readable form.
	 */
	private describeShaderInfo(info: any): string {
		const parts: string[] = []
		if (info.entryPoint) {
			parts.push(`Entry: ${info.entryPoint}`)
		}
		if (info.language) {
			parts.push(`Language: ${info.language}`)
		}
		if (info.instructionCount !== undefined) {
			parts.push(`${info.instructionCount} instructions`)
		}
		return parts.join(", ") || "Shader info retrieved"
	}

	/**
	 * Analyze event characteristics for potential issues.
	 */
	private analyzeEventCharacteristics(
		details: any,
		suspectedIssues: SuspectedIssue[],
	): void {
		// High primitive count may indicate geometry pressure
		if (details.primitiveCount > 100000) {
			suspectedIssues.push({
				category: "performance",
				description: `High primitive count (${details.primitiveCount.toLocaleString()}). This draw may be geometry-bound.`,
				confidence: "medium",
			})
		}

		// Long duration
		if (details.durationMs > 1.0) {
			suspectedIssues.push({
				category: "performance",
				description: `Draw duration (${details.durationMs.toFixed(3)} ms) is significant. This is a hot draw worth investigating.`,
				confidence: "high",
			})
		}
	}

	/**
	 * Analyze pipeline state for potential issues.
	 */
	private analyzePipelineState(
		state: any,
		suspectedIssues: SuspectedIssue[],
	): void {
		// Many render targets may indicate overdraw or complex MRT
		if (state.renderTargets && state.renderTargets.length > 4) {
			suspectedIssues.push({
				category: "performance",
				description: `${state.renderTargets.length} render targets bound. Multiple render targets increase bandwidth pressure.`,
				confidence: "medium",
			})
		}

		// No depth stencil may indicate incorrect depth testing
		if (!state.depthStencil) {
			suspectedIssues.push({
				category: "configuration",
				description: "No depth/stencil buffer bound. This may cause incorrect depth testing or overdraw.",
				confidence: "low",
			})
		}
	}

	/**
	 * Analyze shader complexity for potential issues.
	 */
	private analyzeShaderComplexity(
		info: any,
		suspectedIssues: SuspectedIssue[],
	): void {
		if (info.instructionCount > 500) {
			suspectedIssues.push({
				category: "performance",
				description: `Pixel shader has ${info.instructionCount} instructions. This is a complex shader that may benefit from optimization.`,
				confidence: "medium",
			})
		}

		if (info.constantBuffers && info.constantBuffers.length > 8) {
			suspectedIssues.push({
				category: "resource",
				description: `Shader uses ${info.constantBuffers.length} constant buffers. Consider consolidating to reduce binding overhead.`,
				confidence: "low",
			})
		}
	}

	/**
	 * Build a human-readable summary.
	 */
	private buildSummary(
		selection: any,
		eventDetails: any,
		suspectedIssues: SuspectedIssue[],
	): string {
		const parts: string[] = []

		parts.push(`EID ${selection.eventId}: "${selection.eventName ?? "draw"}"`)

		if (eventDetails.success && eventDetails.durationMs !== undefined) {
			parts.push(`${eventDetails.durationMs.toFixed(3)} ms`)
		}

		if (eventDetails.success && eventDetails.primitiveCount !== undefined) {
			parts.push(`${eventDetails.primitiveCount.toLocaleString()} primitives`)
		}

		const highConfidence = suspectedIssues.filter((i) => i.confidence === "high")
		if (highConfidence.length > 0) {
			parts.push(`Key finding: ${highConfidence[0].description}`)
		}

		return parts.join(". ") + "."
	}

	/**
	 * Generate actionable suggestions based on analysis.
	 */
	private generateSuggestions(
		suspectedIssues: SuspectedIssue[],
		suggestions: string[],
	): void {
		const hasPerformanceIssue = suspectedIssues.some(
			(i) => i.category === "performance" && i.confidence === "high",
		)

		if (hasPerformanceIssue) {
			suggestions.push("Use 'Find Owner In Project' to locate the source code responsible for this draw.")
			suggestions.push("Consider LOD, instancing, or draw call merging to reduce cost.")
		}

		const hasShaderIssue = suspectedIssues.some(
			(i) => i.category === "performance" && i.description.includes("shader"),
		)

		if (hasShaderIssue) {
			suggestions.push("Review the pixel shader for unnecessary texture samples or complex math.")
			suggestions.push("Consider shader permutation to use simpler variants where possible.")
		}

		suggestions.push("Compare this draw with similar draws to identify outliers.")
	}
}
