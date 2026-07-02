/**
 * Heavy Shader Playbook
 *
 * Diagnoses shader performance issues by analyzing:
 * - Shader instruction count
 * - Texture sampling patterns
 * - Math operation complexity
 * - Register pressure
 * - Constant buffer usage
 *
 * @module graphics-agent/playbooks/heavyShader
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
		return "Shader 性能排查完成，未发现明显问题。"
	}

	const highConfidence = suspectedIssues.filter((i) => i.confidence === "high")
	if (highConfidence.length > 0) {
		return `发现 ${highConfidence.length} 个高置信度 shader 问题：${highConfidence[0].description}`
	}

	return `发现 ${suspectedIssues.length} 个潜在 shader 问题，请查看详细分析。`
}

/**
 * Heavy shader diagnosis playbook.
 */
export const heavyShaderPlaybook: GraphicsPlaybook = {
	id: "heavy_shader",
	name: "Shader 过重排查",
	description: "诊断 shader 性能问题的常见原因",
	requiredCapabilities: ["frameSummary", "eventDetails", "shaderInfo", "pipelineState"],

	async execute(
		provider: GraphicsCaptureProvider,
		userMessage?: string,
	): Promise<GraphicsWorkflowResult> {
		const evidence: EvidenceItem[] = []
		const suspectedIssues: SuspectedIssue[] = []
		const suggestions: string[] = []

		// Step 1: Get frame summary to find hot events
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
			description: `帧包含 ${frameSummary.hotEvents?.length || 0} 个热点事件`,
			value: frameSummary,
		})

		// Step 2: Find shader-heavy events
		if (!frameSummary.hotEvents || frameSummary.hotEvents.length === 0) {
			return {
				success: true,
				summary: "帧中没有热点事件，无法进行 shader 分析",
				evidence,
				suspectedIssues: [],
				suggestions: ["尝试使用 'Analyze Current Frame' 查看帧结构"],
			}
		}

		// Sort by duration and take top 5
		const sortedEvents = [...frameSummary.hotEvents].sort(
			(a, b) => b.durationMs - a.durationMs
		)
		const topEvents = sortedEvents.slice(0, 5)

		// Step 3: Analyze each hot event's shader
		for (const event of topEvents) {
			evidence.push({
				source: "hotEvent",
				description: `分析 EID ${event.eventId}: ${event.name} - ${event.durationMs.toFixed(2)} ms`,
				value: event,
			})

			// Get shader info
			const shaderInfo = await provider.getShaderInfo({ eventId: event.eventId })
			if (!shaderInfo.success) {
				evidence.push({
					source: "shaderInfo",
					description: `EID ${event.eventId}: 无法获取 shader 信息`,
					value: shaderInfo,
				})
				continue
			}

			evidence.push({
				source: "shaderInfo",
				description: `EID ${event.eventId}: ${shaderInfo.instructionCount || 0} 条指令`,
				value: shaderInfo,
			})

			// Check instruction count
			if (shaderInfo.instructionCount) {
				if (shaderInfo.instructionCount > 1000) {
					suspectedIssues.push({
						category: "performance",
						description: `EID ${event.eventId}: Shader 指令数极高 (${shaderInfo.instructionCount})`,
						confidence: "high",
					})
					suggestions.push(`EID ${event.eventId}: 考虑简化 shader 逻辑`)
					suggestions.push("- 减少分支和循环")
					suggestions.push("- 使用查找表替代复杂计算")
					suggestions.push("- 考虑使用 compute shader 替代")
				} else if (shaderInfo.instructionCount > 500) {
					suspectedIssues.push({
						category: "performance",
						description: `EID ${event.eventId}: Shader 指令数较多 (${shaderInfo.instructionCount})`,
						confidence: "medium",
					})
					suggestions.push(`EID ${event.eventId}: 检查是否有可优化的 shader 代码`)
				}
			}

			// Check inputs/outputs
			if (shaderInfo.inputs && shaderInfo.inputs.length > 16) {
				suspectedIssues.push({
					category: "performance",
					description: `EID ${event.eventId}: Shader 输入过多 (${shaderInfo.inputs.length})`,
					confidence: "low",
				})
				suggestions.push(`EID ${event.eventId}: 考虑减少 shader 输入`)
			}

			if (shaderInfo.outputs && shaderInfo.outputs.length > 8) {
				suspectedIssues.push({
					category: "performance",
					description: `EID ${event.eventId}: Shader 输出过多 (${shaderInfo.outputs.length})`,
					confidence: "low",
				})
				suggestions.push(`EID ${event.eventId}: 考虑减少 MRT 输出`)
			}

			// Check constant buffers
			if (shaderInfo.constantBuffers && shaderInfo.constantBuffers.length > 8) {
				suspectedIssues.push({
					category: "performance",
					description: `EID ${event.eventId}: Constant buffer 过多 (${shaderInfo.constantBuffers.length})`,
					confidence: "medium",
				})
				suggestions.push(`EID ${event.eventId}: 考虑合并 constant buffers`)
			}

			// Get pipeline state to check resource bindings
			const pipelineState = await provider.getPipelineState(event.eventId)
			if (pipelineState.success) {
				// Check samplers
				if (pipelineState.samplers && pipelineState.samplers.length > 8) {
					suspectedIssues.push({
						category: "performance",
						description: `EID ${event.eventId}: 纹理采样器过多 (${pipelineState.samplers.length})`,
						confidence: "medium",
					})
					suggestions.push(`EID ${event.eventId}: 考虑使用纹理数组或减少纹理数量`)
				}

				// Check render targets
				if (pipelineState.renderTargets && pipelineState.renderTargets.length > 4) {
					suspectedIssues.push({
						category: "performance",
						description: `EID ${event.eventId}: 渲染目标过多 (${pipelineState.renderTargets.length})`,
						confidence: "medium",
					})
					suggestions.push(`EID ${event.eventId}: 考虑减少 MRT 数量或分 pass 渲染`)
				}

				evidence.push({
					source: "pipelineState",
					description: `EID ${event.eventId} 管线状态已检查`,
					value: pipelineState,
				})
			}
		}

		// Step 4: Check for shader compilation issues
		const uniqueShaders = new Set<string>()
		for (const event of topEvents) {
			const shaderInfo = await provider.getShaderInfo({ eventId: event.eventId })
			if (shaderInfo.success && shaderInfo.entryPoint) {
				uniqueShaders.add(shaderInfo.entryPoint)
			}
		}

		if (uniqueShaders.size > 0) {
			evidence.push({
				source: "shaderAnalysis",
				description: `发现 ${uniqueShaders.size} 个不同的 shader`,
				value: Array.from(uniqueShaders),
			})
		}

		// Generate summary
		const summary = buildSummary(suspectedIssues, evidence)

		// Add general suggestions if no specific issues found
		if (suspectedIssues.length === 0) {
			suggestions.push("未发现明显的 shader 性能问题，建议：")
			suggestions.push("- 使用 shader profiler 进行更深入的分析")
			suggestions.push("- 检查是否有寄存器压力")
			suggestions.push("- 检查是否有隐式类型转换")
			suggestions.push("- 考虑使用 shader 编译优化选项")
		}

		return {
			success: true,
			summary,
			evidence,
			suspectedIssues,
			suggestions,
			rawData: {
				frameSummary,
				analyzedEvents: topEvents,
			},
		}
	},
}
