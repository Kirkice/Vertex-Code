/**
 * Mode Handoff Extractor
 *
 * 从 task 状态中提取结构化交接摘要数据。
 * V1 采用确定性提取（不走 LLM），从 todo/messages/phase 中提取。
 *
 * 详见 docs/mode-handoff-summary-implementation-plan.md 第 6.3-6.4 节。
 */

import type { ModeHandoffSummary } from "@roo-code/types"
import type { ModeHandoffExtractInput } from "./ModeHandoffTypes"
import { determineTrigger } from "./ModeHandoffRules"

/**
 * 生成 handoffId（时间戳 + 随机后缀，保证唯一）。
 */
function generateHandoffId(): string {
	return `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 从 todo 列表提取 completed / inProgress / pending。
 */
function extractFromTodos(
	todos: ModeHandoffExtractInput["todos"],
): { completed: string[]; inProgress: string[]; pending: string[] } {
	const completed: string[] = []
	const inProgress: string[] = []
	const pending: string[] = []

	for (const todo of todos) {
		const text = todo.content || todo.activeForm || ""
		if (!text) continue

		const status = todo.status?.toLowerCase()
		if (status === "completed") {
			completed.push(text)
		} else if (status === "in_progress") {
			inProgress.push(text)
		} else {
			pending.push(text)
		}
	}

	return { completed, inProgress, pending }
}

/**
 * 从最近 assistant 文本中提取"已完成动作"短句（当无 todo 时兜底）。
 *
 * V1 简化实现：取最近 3 条 assistant 文本的前 100 字符作为已完成项。
 * 后续可增强为基于关键词提取。
 */
function extractCompletedFromAssistant(recentAssistantTexts: string[]): string[] {
	if (recentAssistantTexts.length === 0) return []
	return recentAssistantTexts.slice(-3).map((text) => {
		// 取第一行或前 100 字符
		const firstLine = text.split("\n")[0] || text
		return firstLine.length > 100 ? firstLine.slice(0, 100) + "..." : firstLine
	})
}

/**
 * 提取阻塞点（openQuestions）。
 */
function extractOpenQuestions(
	blockingStage: ModeHandoffExtractInput["blockingStage"],
): string[] {
	if (!blockingStage) return []
	const stageMap: Record<string, string> = {
		followup: "等待用户回答 followup 问题",
		approval: "等待用户审批",
		review_repair: "处于 review repair 阶段",
	}
	return stageMap[blockingStage] ? [stageMap[blockingStage]] : []
}

/**
 * 生成 recommendedNextStep。
 */
function generateNextStep(toMode: string, pending: string[]): string | undefined {
	if (pending.length > 0) {
		return `继续完成待办事项：${pending[0]}`
	}
	// 根据 toMode 给默认建议
	const defaultSteps: Record<string, string> = {
		code: "继续实现/修改代码",
		architect: "继续分析/规划架构",
		ask: "继续回答用户问题",
		graphics: "继续图形分析",
	}
	return defaultSteps[toMode]
}

/**
 * 从 task 状态提取结构化 ModeHandoffSummary。
 *
 * @param input 提取输入
 * @returns ModeHandoffSummary（不含 consumedAt，由消费时标记）
 */
export function extractHandoffSummary(input: ModeHandoffExtractInput): ModeHandoffSummary {
	const { completed: todoCompleted, inProgress, pending } = extractFromTodos(input.todos)

	// 如果 todo 有数据，用 todo；否则从 assistant 文本兜底
	const completed = todoCompleted.length > 0 ? todoCompleted : extractCompletedFromAssistant(input.recentAssistantTexts)

	const openQuestions = extractOpenQuestions(input.blockingStage)
	const recommendedNextStep = generateNextStep(input.toMode, pending)

	const trigger = determineTrigger({
		fromMode: input.fromMode,
		toMode: input.toMode,
		fromProfile: input.fromProfile,
		toProfile: input.toProfile,
		explicitTrigger: input.trigger,
	})

	return {
		handoffId: generateHandoffId(),
		createdAt: Date.now(),
		trigger,
		fromMode: input.fromMode,
		toMode: input.toMode,
		fromProfile: input.fromProfile,
		toProfile: input.toProfile,
		objective: input.objective,
		completed,
		inProgress,
		pending,
		constraints: input.modeConstraints,
		touchedFiles: input.touchedFiles,
		openQuestions,
		recommendedNextStep,
	}
}
