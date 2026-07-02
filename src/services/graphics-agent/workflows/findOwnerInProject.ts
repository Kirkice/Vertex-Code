/**
 * Find Owner In Project Workflow
 *
 * Maps graphics capture objects (shaders, passes, draws, resources) back to
 * project source code. This workflow helps developers understand which code
 * is responsible for specific rendering operations.
 *
 * User questions this workflow handles:
 * - "这个 shader 对应哪段代码"
 * - "这个 pass 是谁实现的"
 * - "找到这个 draw call 的 owner"
 * - "这个纹理是从哪里来的"
 *
 * @module graphics-agent/workflows/findOwnerInProject
 */

import type { GraphicsCaptureProvider } from "../../graphics-provider/GraphicsCaptureProvider"
import type {
	GraphicsProviderCapabilities,
	GraphicsWorkflowRequest,
	GraphicsWorkflowResult,
	EvidenceItem,
	SuspectedIssue,
	ProjectMappingCandidate,
} from "../../graphics-provider/GraphicsProviderTypes"
import type { GraphicsWorkflow } from "../GraphicsWorkflowOrchestrator"

/**
 * Required capabilities for project mapping.
 */
export const requiredCapabilities: Partial<GraphicsProviderCapabilities> = {
	projectMapping: true,
}

/**
 * Find Owner In Project workflow implementation.
 */
export class FindOwnerInProjectWorkflow implements GraphicsWorkflow {
	readonly intent = "project_mapping" as const
	readonly requiredCapabilities = requiredCapabilities

	async execute(
		provider: GraphicsCaptureProvider,
		request: GraphicsWorkflowRequest,
	): Promise<GraphicsWorkflowResult> {
		const evidence: EvidenceItem[] = []
		const suspectedIssues: SuspectedIssue[] = []
		const suggestions: string[] = []
		const candidates: ProjectMappingCandidate[] = []

		// Parse the user message to determine what to map
		const mappingTarget = this.parseMappingTarget(request.userMessage)

		if (!mappingTarget) {
			return {
				success: false,
				summary: "无法确定要映射的图形对象",
				evidence: [],
				suspectedIssues: [],
				suggestions: [
					"请明确指出要映射的对象，例如：",
					"- '这个 shader 对应哪段代码'",
					"- '找到 ShadowPass 的实现'",
					"- '这个 draw call 的 owner 是谁'",
				],
				error: "No mapping target specified",
			}
		}

		evidence.push({
			source: "userMessage",
			description: `映射目标: ${mappingTarget.kind} "${mappingTarget.identifier}"`,
			value: mappingTarget,
		})

		// If we have an event ID from selection context, use it
		let eventId = request.eventId
		if (!eventId) {
			const selection = await provider.getSelectionContext()
			if (selection.success && selection.eventId) {
				eventId = selection.eventId
				evidence.push({
					source: "selectionContext",
					description: `使用当前选中的 event: EID ${eventId}`,
					value: selection,
				})
			}
		}

		// Query the provider for project implementation
		const mappingResult = await provider.findProjectImplementation({
			kind: mappingTarget.kind,
			identifier: mappingTarget.identifier,
			eventId,
		})

		if (!mappingResult.success) {
			return {
				success: false,
				summary: `无法找到 ${mappingTarget.kind} "${mappingTarget.identifier}" 的项目实现`,
				evidence,
				suspectedIssues: [],
				suggestions: [
					"可能的原因：",
					"- 项目代码未加载或索引不完整",
					"- 图形对象名称与代码中的命名不匹配",
					"- 该对象可能来自外部库或引擎核心",
				],
				error: mappingResult.error,
			}
		}

		// Process candidates
		if (mappingResult.candidates && mappingResult.candidates.length > 0) {
			candidates.push(...mappingResult.candidates)

			evidence.push({
				source: "projectMapping",
				description: `找到 ${candidates.length} 个候选实现`,
				value: candidates,
			})

			// Analyze confidence distribution
			const highConfidence = candidates.filter((c) => c.confidence === "high")
			const mediumConfidence = candidates.filter((c) => c.confidence === "medium")
			const lowConfidence = candidates.filter((c) => c.confidence === "low")

			if (highConfidence.length > 0) {
				evidence.push({
					source: "projectMapping",
					description: `${highConfidence.length} 个高置信度匹配`,
					value: highConfidence,
				})
			}

			if (mediumConfidence.length > 0) {
				evidence.push({
					source: "projectMapping",
					description: `${mediumConfidence.length} 个中置信度匹配`,
					value: mediumConfidence,
				})
			}

			if (lowConfidence.length > 0 && highConfidence.length === 0) {
				suspectedIssues.push({
					category: "correctness",
					description: "只有低置信度匹配，可能需要人工确认",
					confidence: "medium",
				})
			}
		} else {
			evidence.push({
				source: "projectMapping",
				description: "未找到任何候选实现",
			})

			suspectedIssues.push({
				category: "correctness",
				description: "无法在项目中找到对应的实现代码",
				confidence: "high",
			})
		}

		// Generate suggestions based on results
		this.generateSuggestions(candidates, mappingTarget, suggestions)

		// Build summary
		const summary = this.buildSummary(candidates, mappingTarget)

		return {
			success: true,
			summary,
			evidence,
			suspectedIssues,
			suggestions,
			projectMapping: candidates,
			rawData: {
				mappingTarget,
				mappingResult,
			},
		}
	}

	/**
	 * Parse the user message to extract mapping target information.
	 */
	private parseMappingTarget(
		message: string,
	): { kind: "shader" | "pass" | "draw" | "resource"; identifier: string } | null {
		const lowerMessage = message.toLowerCase()

		// Try to identify the kind of object
		let kind: "shader" | "pass" | "draw" | "resource" | null = null

		if (
			lowerMessage.includes("shader") ||
			lowerMessage.includes("着色器") ||
			lowerMessage.includes("顶点") ||
			lowerMessage.includes("像素") ||
			lowerMessage.includes("计算")
		) {
			kind = "shader"
		} else if (
			lowerMessage.includes("pass") ||
			lowerMessage.includes("通道") ||
			lowerMessage.includes("阶段")
		) {
			kind = "pass"
		} else if (
			lowerMessage.includes("draw") ||
			lowerMessage.includes("绘制") ||
			lowerMessage.includes("drawcall")
		) {
			kind = "draw"
		} else if (
			lowerMessage.includes("texture") ||
			lowerMessage.includes("buffer") ||
			lowerMessage.includes("纹理") ||
			lowerMessage.includes("缓冲区") ||
			lowerMessage.includes("资源")
		) {
			kind = "resource"
		}

		// Try to extract identifier (name or ID)
		let identifier: string | null = null

		// Look for quoted strings
		const quotedMatch = message.match(/["']([^"']+)["']/)
		if (quotedMatch) {
			identifier = quotedMatch[1]
		}

		// Look for EID pattern
		const eidMatch = message.match(/EID\s*(\d+)/i)
		if (eidMatch) {
			identifier = `EID ${eidMatch[1]}`
			kind = kind || "draw"
		}

		// Look for common naming patterns
		if (!identifier) {
			// Try to find capitalized words that might be names
			const nameMatch = message.match(/\b([A-Z][a-zA-Z0-9_]+(?:Pass|Shader|Draw|Texture|Buffer))\b/)
			if (nameMatch) {
				identifier = nameMatch[1]
				// Infer kind from suffix if not already set
				if (!kind) {
					if (identifier.endsWith("Pass")) kind = "pass"
					else if (identifier.endsWith("Shader")) kind = "shader"
					else if (identifier.endsWith("Texture")) kind = "resource"
					else if (identifier.endsWith("Buffer")) kind = "resource"
					else kind = "draw"
				}
			}
		}

		// If we still don't have an identifier, use the whole message as a query
		if (!identifier) {
			// Extract key terms
			const keyTerms = message
				.replace(/[，。？！、]/g, " ")
				.split(/\s+/)
				.filter((word) => word.length > 2 && !["这个", "那个", "哪个", "哪里", "对应", "实现", "代码", "owner"].includes(word))

			if (keyTerms.length > 0) {
				identifier = keyTerms.join(" ")
				kind = kind || "draw"
			}
		}

		if (!kind || !identifier) {
			return null
		}

		return { kind, identifier }
	}

	/**
	 * Generate suggestions based on mapping results.
	 */
	private generateSuggestions(
		candidates: ProjectMappingCandidate[],
		mappingTarget: { kind: string; identifier: string },
		suggestions: string[],
	): void {
		if (candidates.length === 0) {
			suggestions.push("尝试使用不同的关键词或名称进行搜索")
			suggestions.push("检查项目代码是否已正确加载和索引")
			suggestions.push("查看图形调试器中的对象详细信息，获取更多上下文")
			return
		}

		// Suggest reviewing high-confidence matches first
		const highConfidence = candidates.filter((c) => c.confidence === "high")
		if (highConfidence.length > 0) {
			suggestions.push(`优先查看高置信度匹配: ${highConfidence[0].filePath}`)
		}

		// Suggest related analysis
		suggestions.push("使用 'Explain Selected Draw' 分析相关 draw call 的详细信息")
		suggestions.push("检查找到的代码文件，确认是否包含相关的渲染逻辑")

		// Suggest code review actions
		if (mappingTarget.kind === "shader") {
			suggestions.push("查看 shader 代码，分析性能瓶颈和优化机会")
		} else if (mappingTarget.kind === "pass") {
			suggestions.push("查看 pass 的配置和设置，理解渲染流程")
		}
	}

	/**
	 * Build a summary of the mapping results.
	 */
	private buildSummary(
		candidates: ProjectMappingCandidate[],
		mappingTarget: { kind: string; identifier: string },
	): string {
		if (candidates.length === 0) {
			return `未找到 ${mappingTarget.kind} "${mappingTarget.identifier}" 的项目实现`
		}

		const highConfidence = candidates.filter((c) => c.confidence === "high")
		const topCandidate = candidates[0]

		let summary = `找到 ${candidates.length} 个候选实现`

		if (highConfidence.length > 0) {
			summary += `，其中 ${highConfidence.length} 个高置信度匹配`
		}

		summary += `。最佳匹配: ${topCandidate.filePath}`
		if (topCandidate.line) {
			summary += `:${topCandidate.line}`
		}
		if (topCandidate.functionName) {
			summary += ` (${topCandidate.functionName})`
		}

		return summary
	}
}
