/**
 * Shadow Issue Playbook
 *
 * Diagnoses shadow rendering issues by analyzing:
 * - Shadow map passes and their configuration
 * - Depth buffer state and precision
 * - Shadow cascade settings
 * - Shadow bias and acne artifacts
 * - Light direction and shadow projection
 *
 * @module graphics-agent/playbooks/shadowIssue
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
		return "阴影问题排查完成，未发现明显问题。"
	}

	const highConfidence = suspectedIssues.filter((i) => i.confidence === "high")
	if (highConfidence.length > 0) {
		return `发现 ${highConfidence.length} 个高置信度阴影问题：${highConfidence[0].description}`
	}

	return `发现 ${suspectedIssues.length} 个潜在阴影问题，请查看详细分析。`
}

/**
 * Shadow issue diagnosis playbook.
 */
export const shadowIssuePlaybook: GraphicsPlaybook = {
	id: "shadow_issue",
	name: "阴影问题排查",
	description: "诊断阴影渲染问题的常见原因",
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
			description: `帧包含 ${frameSummary.passes?.length || 0} 个 pass`,
			value: frameSummary,
		})

		// Step 2: Find shadow-related passes
		if (frameSummary.passes && frameSummary.passes.length > 0) {
			const shadowPasses = frameSummary.passes.filter((pass) => {
				const name = pass.name?.toLowerCase() || ""
				return (
					name.includes("shadow") ||
					name.includes("depth") ||
					name.includes("csm") ||
					name.includes("cascade")
				)
			})

			if (shadowPasses.length === 0) {
				suspectedIssues.push({
					category: "correctness",
					description: "帧中未找到阴影相关的 pass",
					confidence: "high",
				})
				suggestions.push("检查是否启用了阴影渲染")
				suggestions.push("确认光源是否配置了阴影投射")
			} else {
				evidence.push({
					source: "shadowPasses",
					description: `找到 ${shadowPasses.length} 个阴影相关 pass`,
					value: shadowPasses,
				})

				// Analyze each shadow pass
				for (const pass of shadowPasses) {
					const startEventId = pass.eventIdRange?.[0]
					if (startEventId !== undefined) {
						const eventDetails = await provider.getEventDetails(startEventId)
						if (eventDetails.success) {
							evidence.push({
								source: "shadowPassDetails",
								description: `Shadow pass "${pass.name}": ${eventDetails.durationMs?.toFixed(2) || "?"} ms`,
								value: eventDetails,
							})

							// Check if shadow pass is too expensive
							if (
								eventDetails.durationMs &&
								frameSummary.totalDurationMs &&
								eventDetails.durationMs / frameSummary.totalDurationMs > 0.3
							) {
								suspectedIssues.push({
									category: "performance",
									description: `阴影 pass "${pass.name}" 占用帧时间超过 30%`,
									confidence: "medium",
								})
								suggestions.push("考虑降低阴影分辨率")
								suggestions.push("减少级联阴影的级数")
							}
						}

						// Check pipeline state for depth buffer
						const pipelineState = await provider.getPipelineState(startEventId)
						if (pipelineState.success) {
							if (!pipelineState.depthStencil) {
								suspectedIssues.push({
									category: "correctness",
									description: `阴影 pass "${pass.name}" 未绑定深度缓冲`,
									confidence: "high",
								})
								suggestions.push("确保阴影 pass 正确绑定深度缓冲")
							}

							evidence.push({
								source: "shadowPipelineState",
								description: `Shadow pass "${pass.name}" 管线状态`,
								value: pipelineState,
							})
						}
					}
				}
			}
		}

		// Step 3: Check for shadow receiving passes
		if (frameSummary.passes && frameSummary.passes.length > 0) {
			const lightingPasses = frameSummary.passes.filter((pass) => {
				const name = pass.name?.toLowerCase() || ""
				return (
					name.includes("lighting") ||
					name.includes("deferred") ||
					name.includes("forward") ||
					name.includes("main")
				)
			})

			for (const pass of lightingPasses) {
				const startEventId = pass.eventIdRange?.[0]
				if (startEventId !== undefined) {
					const shaderInfo = await provider.getShaderInfo({ eventId: startEventId })
					if (shaderInfo.success) {
						// Check if shader samples shadow map
						const hasShadowSampling =
							shaderInfo.constantBuffers?.some((cb) =>
								cb.toLowerCase().includes("shadow"),
							) || false

						if (!hasShadowSampling) {
							suspectedIssues.push({
								category: "correctness",
								description: `光照 pass "${pass.name}" 的 shader 可能未采样阴影贴图`,
								confidence: "low",
							})
							suggestions.push("检查光照 shader 是否正确采样阴影贴图")
						}

						evidence.push({
							source: "lightingShaderInfo",
							description: `Lighting pass "${pass.name}" shader 信息`,
							value: shaderInfo,
						})
					}
				}
			}
		}

		// Generate summary
		const summary = buildSummary(suspectedIssues, evidence)

		// Add general suggestions if no specific issues found
		if (suspectedIssues.length === 0) {
			suggestions.push("未发现明显的阴影问题，建议：")
			suggestions.push("- 检查阴影 bias 设置，避免 shadow acne")
			suggestions.push("- 检查阴影贴图分辨率是否足够")
			suggestions.push("- 检查级联阴影的分割距离是否合理")
			suggestions.push("- 检查 PCF 采样设置")
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
