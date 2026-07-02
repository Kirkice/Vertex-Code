/**
 * GPU Slow Playbook
 *
 * Diagnoses GPU performance issues by analyzing:
 * - Frame timing breakdown
 * - Hot events and their costs
 * - Overdraw patterns
 * - Shader complexity
 * - Resource bandwidth
 *
 * @module graphics-agent/playbooks/gpuSlow
 */

import type { GraphicsCaptureProvider } from "../../graphics-provider/GraphicsCaptureProvider"
import type {
	GraphicsWorkflowResult,
	EvidenceItem,
	SuspectedIssue,
} from "../../graphics-provider/GraphicsProviderTypes"
import type { GraphicsPlaybook } from "./playbookRunner"

/**
 * Build summary from suspected issues and evidence
 */
function buildSummary(suspectedIssues: SuspectedIssue[], evidence: EvidenceItem[]): string {
	if (suspectedIssues.length === 0) {
		return "GPU 性能排查完成，未发现明显性能瓶颈。"
	}

	const highConfidence = suspectedIssues.filter((i) => i.confidence === "high")
	if (highConfidence.length > 0) {
		return `发现 ${highConfidence.length} 个高置信度性能问题：${highConfidence[0].description}`
	}

	return `发现 ${suspectedIssues.length} 个潜在性能问题，请查看详细分析。`
}

/**
 * GPU slow diagnosis playbook.
 */
export const gpuSlowPlaybook: GraphicsPlaybook = {
	id: "gpu_slow",
	name: "GPU 慢排查",
	description: "诊断 GPU 性能问题的常见原因",
	requiredCapabilities: ["frameSummary", "eventDetails", "pipelineState", "shaderInfo"],

	async execute(
		provider: GraphicsCaptureProvider,
		userMessage?: string,
	): Promise<GraphicsWorkflowResult> {
		const evidence: EvidenceItem[] = []
		const suspectedIssues: SuspectedIssue[] = []
		const suggestions: string[] = []

		// Step 1: Get frame summary
		const frameSummary = await provider.getFrameSummary()
		if (!frameSummary.success) {
			return {
				success: false,
				summary: "无法获取帧摘要",
				evidence: [],
				suspectedIssues: [],
				suggestions: ["请确保已打开 capture 文件"],
				error: frameSummary.error,
			}
		}

		evidence.push({
			source: "frameSummary",
			description: `帧总耗时: ${frameSummary.totalDurationMs?.toFixed(2) || "unknown"} ms`,
			value: frameSummary,
		})

		// Step 2: Analyze frame timing
		if (frameSummary.totalDurationMs) {
			const frameTime = frameSummary.totalDurationMs
			const targetFps60 = 16.67
			const targetFps30 = 33.33

			if (frameTime > targetFps30) {
				suspectedIssues.push({
					category: "performance",
					description: `帧耗时 ${frameTime.toFixed(2)} ms 超过 30 FPS 目标 (${targetFps30} ms)`,
					confidence: "high",
				})
			} else if (frameTime > targetFps60) {
				suspectedIssues.push({
					category: "performance",
					description: `帧耗时 ${frameTime.toFixed(2)} ms 超过 60 FPS 目标 (${targetFps60} ms)`,
					confidence: "medium",
				})
			}
		}

		// Step 3: Analyze hot events
		if (frameSummary.hotEvents && frameSummary.hotEvents.length > 0) {
			// Sort by duration
			const sortedEvents = [...frameSummary.hotEvents].sort(
				(a, b) => b.durationMs - a.durationMs
			)

			// Check top 3 hot events
			const topEvents = sortedEvents.slice(0, 3)
			for (const event of topEvents) {
				evidence.push({
					source: "hotEvent",
					description: `EID ${event.eventId}: ${event.name} - ${event.durationMs.toFixed(2)} ms`,
					value: event,
				})

				// Get detailed info for the hottest event
				if (event === topEvents[0]) {
					const eventDetails = await provider.getEventDetails(event.eventId)
					if (eventDetails.success) {
						evidence.push({
							source: "eventDetails",
							description: `EID ${event.eventId} 详细信息`,
							value: eventDetails,
						})

						// Check primitive count
						if (eventDetails.primitiveCount && eventDetails.primitiveCount > 100000) {
							suspectedIssues.push({
								category: "performance",
								description: `EID ${event.eventId}: 高图元数量 (${eventDetails.primitiveCount.toLocaleString()})`,
								confidence: "medium",
							})
							suggestions.push(`考虑对 EID ${event.eventId} 使用 LOD 或实例化`)
						}

						// Check draw call count
						if (eventDetails.drawCallCount && eventDetails.drawCallCount > 100) {
							suspectedIssues.push({
								category: "performance",
								description: `EID ${event.eventId}: 高 draw call 数量 (${eventDetails.drawCallCount})`,
								confidence: "medium",
							})
							suggestions.push(`考虑合并 EID ${event.eventId} 的 draw calls`)
						}
					}

					// Check shader complexity
					const shaderInfo = await provider.getShaderInfo({ eventId: event.eventId })
					if (shaderInfo.success) {
						evidence.push({
							source: "shaderInfo",
							description: `EID ${event.eventId} shader 信息`,
							value: shaderInfo,
						})

						// Check instruction count
						if (shaderInfo.instructionCount && shaderInfo.instructionCount > 500) {
							suspectedIssues.push({
								category: "performance",
								description: `EID ${event.eventId}: Shader 指令数过多 (${shaderInfo.instructionCount})`,
								confidence: "high",
							})
							suggestions.push(`优化 EID ${event.eventId} 的 shader 代码`)
							suggestions.push("- 减少纹理采样")
							suggestions.push("- 简化数学运算")
							suggestions.push("- 使用 shader permutation 选择简单变体")
						}

						// Check constant buffers
						if (shaderInfo.constantBuffers && shaderInfo.constantBuffers.length > 8) {
							suspectedIssues.push({
								category: "performance",
								description: `EID ${event.eventId}: Constant buffer 数量过多 (${shaderInfo.constantBuffers.length})`,
								confidence: "low",
							})
							suggestions.push(`考虑合并 EID ${event.eventId} 的 constant buffers`)
						}
					}
				}
			}

			// Check for many small events (CPU bottleneck indicator)
			const smallEvents = frameSummary.hotEvents.filter((e) => e.durationMs < 0.1)
			if (smallEvents.length > frameSummary.hotEvents.length * 0.5) {
				suspectedIssues.push({
					category: "performance",
					description: "大量小事件，可能是 CPU 提交瓶颈",
					confidence: "medium",
				})
				suggestions.push("检查是否有过多的 draw call 提交")
				suggestions.push("考虑使用 GPU-driven rendering 或 indirect draw")
			}
		}

		// Step 4: Analyze pass structure
		if (frameSummary.passes && frameSummary.passes.length > 0) {
			// Find the most expensive pass
			const passDurations = frameSummary.passes
				.filter((p) => p.durationMs !== undefined)
				.sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))

			if (passDurations.length > 0) {
				const topPass = passDurations[0]
				evidence.push({
					source: "passAnalysis",
					description: `最耗时的 pass: ${topPass.name} - ${topPass.durationMs?.toFixed(2)} ms`,
					value: topPass,
				})

				if (topPass.durationMs && frameSummary.totalDurationMs) {
					const passPercentage = (topPass.durationMs / frameSummary.totalDurationMs) * 100
					if (passPercentage > 50) {
						suspectedIssues.push({
							category: "performance",
							description: `Pass "${topPass.name}" 占用 ${passPercentage.toFixed(1)}% 的帧时间`,
							confidence: "high",
						})
						suggestions.push(`优先优化 pass "${topPass.name}"`)
					}
				}
			}
		}

		// Generate summary
		const summary = buildSummary(suspectedIssues, evidence)

		// Add general suggestions if no specific issues found
		if (suspectedIssues.length === 0) {
			suggestions.push("未发现明显的性能瓶颈，建议：")
			suggestions.push("- 使用 GPU profiler 进行更深入的分析")
			suggestions.push("- 检查是否有 overdraw 问题")
			suggestions.push("- 检查纹理和 buffer 的带宽使用")
		}

		return {
			success: true,
			summary,
			evidence,
			suspectedIssues,
			suggestions,
			rawData: {
				frameSummary,
			},
		}
	},
}
