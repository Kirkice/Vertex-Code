/**
 * Mode Handoff Extractor
 *
 * Deterministically extracts a structured handoff summary from task state.
 */

import type { ModeHandoffSummary } from "@roo-code/types"
import type { ModeHandoffExtractInput } from "./ModeHandoffTypes"
import { determineTrigger } from "./ModeHandoffRules"

function generateHandoffId(): string {
	return `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function extractFromTodos(
	todos: ModeHandoffExtractInput["todos"],
): { completed: string[]; inProgress: string[]; pending: string[] } {
	const completed: string[] = []
	const inProgress: string[] = []
	const pending: string[] = []

	for (const todo of todos) {
		const text = todo.content || todo.activeForm || ""
		if (!text) {
			continue
		}

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

function extractCompletedFromAssistant(recentAssistantTexts: string[]): string[] {
	if (recentAssistantTexts.length === 0) {
		return []
	}

	return recentAssistantTexts.slice(-3).map((text) => {
		const firstLine = text.split("\n")[0] || text
		return firstLine.length > 100 ? `${firstLine.slice(0, 100)}...` : firstLine
	})
}

function extractOpenQuestions(blockingStage: ModeHandoffExtractInput["blockingStage"]): string[] {
	if (!blockingStage) {
		return []
	}

	const stageMap: Record<string, string> = {
		followup: "等待用户回答 followup 问题",
		approval: "等待用户批准",
		review_repair: "处于 review repair 阶段",
	}

	return stageMap[blockingStage] ? [stageMap[blockingStage]] : []
}

function generateNextStep(toMode: string, pending: string[]): string | undefined {
	if (pending.length > 0) {
		return `继续完成待办事项：${pending[0]}`
	}

	const defaultSteps: Record<string, string> = {
		code: "继续实现/修改代码",
		architect: "继续分析/规划架构",
		ask: "继续回答用户问题",
		graphics: "继续图形分析",
	}

	return defaultSteps[toMode]
}

export function extractHandoffSummary(input: ModeHandoffExtractInput): ModeHandoffSummary {
	const { completed: todoCompleted, inProgress, pending } = extractFromTodos(input.todos)
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
		acceptanceCriteria: input.acceptanceCriteria,
		validationMode: input.validationMode,
	}
}
