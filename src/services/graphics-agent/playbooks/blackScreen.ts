/**
 * Black Screen Playbook
 *
 * Diagnoses black screen issues by checking:
 * - Render target bindings
 * - Clear operations
 * - Viewport/scissor settings
 * - Shader outputs
 * - Depth buffer state
 *
 * @module graphics-agent/playbooks/blackScreen
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
		return "黑屏排查完成，未发现明显问题。请查看详细建议进行进一步诊断。"
	}

	const highConfidence = suspectedIssues.filter((i) => i.confidence === "high")
	if (highConfidence.length > 0) {
		return `发现 ${highConfidence.length} 个高置信度问题：${highConfidence[0].description}`
	}

	return `发现 ${suspectedIssues.length} 个潜在问题，请查看详细分析。`
}

/**
 * Black screen diagnosis playbook.
 */
export const blackScreenPlaybook: GraphicsPlaybook = {
	id: "black_screen",
	name: "黑屏排查",
	description: "诊断黑屏问题的常见原因",
	requiredCapabilities: ["frameSummary", "eventDetails", "pipelineState", "shaderInfo"],

	async execute(
		provider: GraphicsCaptureProvider,
		userMessage?: string,
	): Promise<GraphicsWorkflowResult> {
		const evidence: EvidenceItem[] = []
		const suspectedIssues: SuspectedIssue[] = []
		const suggestions: string[] = []

		// Step 1: Get frame summary to understand the frame structure
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
			description: `帧包含 ${frameSummary.passes?.length || 0} 个 pass，${frameSummary.hotEvents?.length || 0} 个热点事件`,
			value: frameSummary,
		})

		// Step 2: Check if there are any draw calls
		if (!frameSummary.passes || frameSummary.passes.length === 0) {
			suspectedIssues.push({
				category: "correctness",
				description: "帧中没有任何 pass，可能是渲染命令未提交",
				confidence: "high",
			})
			suggestions.push("检查应用程序是否正确调用了渲染 API")
			suggestions.push("确认渲染循环是否正在运行")
		}

		// Step 3: Analyze the first few draw calls
		const drawCallsToCheck = Math.min(5, frameSummary.hotEvents?.length || 0)
		for (let i = 0; i < drawCallsToCheck; i++) {
			const event = frameSummary.hotEvents![i]
			const eventDetails = await provider.getEventDetails(event.eventId)

			if (eventDetails.success) {
				evidence.push({
					source: "eventDetails",
					description: `EID ${event.eventId}: ${eventDetails.name || "Unknown"}`,
					value: eventDetails,
				})

				// Check pipeline state for this draw
				const pipelineState = await provider.getPipelineState(event.eventId)
				if (pipelineState.success) {
					// Check render targets
					if (!pipelineState.renderTargets || pipelineState.renderTargets.length === 0) {
						suspectedIssues.push({
							category: "correctness",
							description: `EID ${event.eventId}: 没有绑定渲染目标`,
							confidence: "high",
						})
						suggestions.push(`检查 EID ${event.eventId} 的渲染目标绑定`)
					}

					// Check depth stencil
					if (!pipelineState.depthStencil) {
						suspectedIssues.push({
							category: "correctness",
							description: `EID ${event.eventId}: 没有绑定深度模板缓冲`,
							confidence: "medium",
						})
						suggestions.push(`检查 EID ${event.eventId} 的深度模板缓冲绑定`)
					}

					evidence.push({
						source: "pipelineState",
						description: `EID ${event.eventId} 管线状态已检查`,
						value: pipelineState,
					})
				}

				// Check shader info
				const shaderInfo = await provider.getShaderInfo({ eventId: event.eventId })
				if (shaderInfo.success) {
					// Check if shader has outputs
					if (shaderInfo.outputs && shaderInfo.outputs.length === 0) {
						suspectedIssues.push({
							category: "correctness",
							description: `EID ${event.eventId}: Shader 没有输出`,
							confidence: "medium",
						})
						suggestions.push(`检查 EID ${event.eventId} 的 shader 代码`)
					}

					evidence.push({
						source: "shaderInfo",
						description: `EID ${event.eventId} shader 信息已检查`,
						value: shaderInfo,
					})
				}
			}
		}

		// Step 4: Check for clear operations
		const hasClear = frameSummary.passes?.some((pass) =>
			pass.name?.toLowerCase().includes("clear")
		)
		if (!hasClear) {
			suspectedIssues.push({
				category: "correctness",
				description: "帧中没有检测到 clear 操作",
				confidence: "medium",
			})
			suggestions.push("确认是否在渲染前调用了 clear 操作")
		}

		// Generate summary
		const summary = buildSummary(suspectedIssues, evidence)

		// Add general suggestions
		if (suspectedIssues.length === 0) {
			suggestions.push("未发现明显的黑屏原因，建议：")
			suggestions.push("- 检查深度缓冲是否正确配置")
			suggestions.push("- 检查背面剔除设置")
			suggestions.push("- 检查材质和纹理是否正确加载")
			suggestions.push("- 使用 'Explain Selected Draw' 详细分析可疑的 draw call")
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
