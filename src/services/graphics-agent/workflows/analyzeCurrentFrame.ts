/**
 * Analyze Current Frame Workflow
 *
 * Handles frame-level analysis: identifying hot events, pass structure,
 * and performance bottlenecks in the current capture.
 *
 * User questions this workflow handles:
 * - "为什么这一帧这么慢"
 * - "分析当前帧"
 * - "当前 capture 的主要 pass 是什么"
 *
 * @module graphics-agent/workflows/analyzeCurrentFrame
 */

import type { GraphicsCaptureProvider } from "../../graphics-provider/GraphicsCaptureProvider"
import type {
	GraphicsProviderCapabilities,
	GraphicsWorkflowRequest,
	GraphicsWorkflowResult,
	EvidenceItem,
	SuspectedIssue,
	HotEventSummary,
} from "../../graphics-provider/GraphicsProviderTypes"
import type { GraphicsWorkflow } from "../GraphicsWorkflowOrchestrator"

/**
 * Required capabilities for frame analysis.
 */
export const requiredCapabilities: Partial<GraphicsProviderCapabilities> = {
	frameSummary: true,
	passGraph: true,
}

/**
 * Analyze Current Frame workflow implementation.
 */
export class AnalyzeCurrentFrameWorkflow implements GraphicsWorkflow {
	readonly intent = "frame_summary" as const
	readonly requiredCapabilities = requiredCapabilities

	async execute(
		provider: GraphicsCaptureProvider,
		request: GraphicsWorkflowRequest,
	): Promise<GraphicsWorkflowResult> {
		const evidence: EvidenceItem[] = []
		const suspectedIssues: SuspectedIssue[] = []
		const suggestions: string[] = []

		// Step 1: Ensure capture is open
		const captureResult = await provider.openCurrentCapture()
		if (!captureResult.success) {
			return {
				success: false,
				summary: "Failed to open capture",
				evidence: [],
				suspectedIssues: [],
				suggestions: ["Please ensure a capture is loaded in your graphics tool."],
				error: captureResult.error,
			}
		}

		evidence.push({
			source: "openCapture",
			description: `Capture opened: ${captureResult.capturePath ?? "unknown"}`,
			value: { api: captureResult.api, frameCount: captureResult.frameCount },
		})

		// Step 2: Get frame summary
		const frameSummary = await provider.getFrameSummary()
		if (!frameSummary.success) {
			return {
				success: false,
				summary: "Failed to retrieve frame summary",
				evidence,
				suspectedIssues: [],
				suggestions: ["The provider may not support frame summary. Check capabilities."],
				error: frameSummary.error,
			}
		}

		evidence.push({
			source: "frameSummary",
			description: `Frame duration: ${frameSummary.totalDurationMs?.toFixed(2) ?? "unknown"} ms`,
			value: { totalDurationMs: frameSummary.totalDurationMs },
		})

		// Step 3: Analyze passes
		if (frameSummary.passes && frameSummary.passes.length > 0) {
			evidence.push({
				source: "frameSummary",
				description: `Found ${frameSummary.passes.length} render passes`,
				value: frameSummary.passes,
			})

			// Identify expensive passes
			const sortedPasses = [...frameSummary.passes].sort(
				(a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0),
			)
			const topPass = sortedPasses[0]
			if (topPass && topPass.durationMs) {
				const passPercentage = frameSummary.totalDurationMs
					? ((topPass.durationMs / frameSummary.totalDurationMs) * 100).toFixed(1)
					: "unknown"
				evidence.push({
					source: "frameSummary",
					description: `Most expensive pass: "${topPass.name}" (${topPass.durationMs.toFixed(2)} ms, ${passPercentage}% of frame)`,
					value: topPass,
				})
			}
		}

		// Step 4: Analyze hot events
		if (frameSummary.hotEvents && frameSummary.hotEvents.length > 0) {
			evidence.push({
				source: "frameSummary",
				description: `Found ${frameSummary.hotEvents.length} hot events`,
				value: frameSummary.hotEvents,
			})

			// Identify the hottest event
			const hottestEvent = frameSummary.hotEvents.reduce((max, curr) =>
				curr.durationMs > max.durationMs ? curr : max,
			)

			evidence.push({
				source: "frameSummary",
				description: `Hottest event: EID ${hottestEvent.eventId} "${hottestEvent.name}" (${hottestEvent.durationMs.toFixed(2)} ms)`,
				value: hottestEvent,
			})

			// Analyze hot event patterns
			this.analyzeHotEventPatterns(frameSummary.hotEvents, suspectedIssues)
		}

		// Step 5: Generate performance assessment
		this.assessPerformance(frameSummary, suspectedIssues, suggestions)

		// Build summary
		const summary = this.buildSummary(frameSummary, suspectedIssues)

		return {
			success: true,
			summary,
			evidence,
			suspectedIssues,
			suggestions,
			rawData: {
				capture: captureResult,
				frameSummary,
			},
		}
	}

	/**
	 * Analyze patterns in hot events to identify suspected issues.
	 */
	private analyzeHotEventPatterns(
		hotEvents: HotEventSummary[],
		suspectedIssues: SuspectedIssue[],
	): void {
		// Check for many small draws (potential CPU bottleneck)
		const smallDraws = hotEvents.filter((e) => e.durationMs < 0.1)
		if (smallDraws.length > hotEvents.length * 0.5) {
			suspectedIssues.push({
				category: "performance",
				description: "Many small draw calls detected. This may indicate CPU submission overhead rather than GPU bottleneck.",
				confidence: "medium",
			})
		}

		// Check for single dominant event
		if (hotEvents.length > 0) {
			const totalDuration = hotEvents.reduce((sum, e) => sum + e.durationMs, 0)
			const maxEvent = hotEvents.reduce((max, curr) =>
				curr.durationMs > max.durationMs ? curr : max,
			)
			const dominance = maxEvent.durationMs / totalDuration
			if (dominance > 0.5) {
				suspectedIssues.push({
					category: "performance",
					description: `Single event (EID ${maxEvent.eventId}) dominates ${Math.round(dominance * 100)}% of hot event time. Focus optimization here for maximum impact.`,
					confidence: "high",
				})
			}
		}

		// Check for events in same pass clustering
		const passGroups = new Map<string, HotEventSummary[]>()
		for (const event of hotEvents) {
			const passName = event.passName ?? "unknown"
			if (!passGroups.has(passName)) {
				passGroups.set(passName, [])
			}
			passGroups.get(passName)!.push(event)
		}

		for (const [passName, events] of passGroups) {
			if (events.length >= 3) {
				suspectedIssues.push({
					category: "performance",
					description: `Pass "${passName}" has ${events.length} hot events. Consider reviewing the entire pass for optimization opportunities.`,
					confidence: "medium",
				})
			}
		}
	}

	/**
	 * Assess overall frame performance and generate suggestions.
	 */
	private assessPerformance(
		frameSummary: { totalDurationMs?: number; passes?: any[]; hotEvents?: HotEventSummary[] },
		suspectedIssues: SuspectedIssue[],
		suggestions: string[],
	): void {
		if (!frameSummary.totalDurationMs) {
			return
		}

		const frameTime = frameSummary.totalDurationMs
		const targetFps60 = 16.67 // ms per frame at 60 FPS
		const targetFps30 = 33.33 // ms per frame at 30 FPS

		if (frameTime > targetFps30) {
			suspectedIssues.push({
				category: "performance",
				description: `Frame time (${frameTime.toFixed(2)} ms) exceeds 30 FPS target (${targetFps30} ms). Significant optimization needed.`,
				confidence: "high",
			})
			suggestions.push("Prioritize the hottest events for optimization.")
			suggestions.push("Consider reducing render pass complexity or draw call count.")
		} else if (frameTime > targetFps60) {
			suspectedIssues.push({
				category: "performance",
				description: `Frame time (${frameTime.toFixed(2)} ms) exceeds 60 FPS target (${targetFps60} ms) but meets 30 FPS.`,
				confidence: "medium",
			})
			suggestions.push("Review the most expensive pass for optimization opportunities.")
		} else {
			suggestions.push("Frame performance is within 60 FPS target. Focus on correctness or visual quality.")
		}

		// General suggestions
		suggestions.push("Use 'Explain Selected Draw' to analyze specific hot events in detail.")
		suggestions.push("Use 'Find Owner In Project' to map hot events to source code.")
	}

	/**
	 * Build a human-readable summary of the frame analysis.
	 */
	private buildSummary(
		frameSummary: { totalDurationMs?: number; passes?: any[]; hotEvents?: HotEventSummary[] },
		suspectedIssues: SuspectedIssue[],
	): string {
		const parts: string[] = []

		if (frameSummary.totalDurationMs) {
			parts.push(`Frame time: ${frameSummary.totalDurationMs.toFixed(2)} ms`)
		}

		if (frameSummary.passes) {
			parts.push(`${frameSummary.passes.length} render passes`)
		}

		if (frameSummary.hotEvents) {
			parts.push(`${frameSummary.hotEvents.length} hot events identified`)
		}

		if (suspectedIssues.length > 0) {
			const highConfidence = suspectedIssues.filter((i) => i.confidence === "high")
			if (highConfidence.length > 0) {
				parts.push(`Primary concern: ${highConfidence[0].description}`)
			}
		}

		return parts.join(". ") + "."
	}
}
