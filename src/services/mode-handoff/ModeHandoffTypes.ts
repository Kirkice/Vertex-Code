/**
 * Mode Handoff 类型定义
 *
 * 详见 docs/mode-handoff-summary-implementation-plan.md
 */

import type { ModeHandoffSummary, ModeHandoffTrigger } from "@roo-code/types"

export type { ModeHandoffSummary, ModeHandoffTrigger }

/**
 * Handoff 生成输入：从 task 状态中提取交接摘要所需的上下文。
 */
export interface ModeHandoffExtractInput {
	/** 当前 task 的最新用户目标（取最近一条用户消息文本） */
	objective: string
	/** todo 列表（用于提取 completed/inProgress/pending） */
	todos: Array<{
		content?: string
		status?: string
		activeForm?: string
	}>
	/** 最近若干条 assistant 文本结论 */
	recentAssistantTexts: string[]
	/** task 期间读写过的文件集合 */
	touchedFiles: string[]
	/** 当前是否处于 followup/approval/review repair 阶段 */
	blockingStage?: "followup" | "approval" | "review_repair" | undefined
	/** 当前 Mode 语义约束（只读/读写等） */
	modeConstraints: string[]
	/** 切换前 Mode */
	fromMode?: string
	/** 切换目标 Mode */
	toMode: string
	/** 切换前 Profile */
	fromProfile?: string
	/** 切换目标 Profile */
	toProfile?: string
	/** 触发类型 */
	trigger: ModeHandoffTrigger
	/** 是否启用了 Mode-Level LLM Routing（多模型模式）。
	 *  - true：Mode 切换可能伴随 Profile 切换，Mode 变化即触发 Handoff
	 *  - false（单模型）：所有 Mode 共用同一 Profile，仅 Profile 变化才触发 Handoff
	 */
	routingEnabled?: boolean
	/** 验收标准：由 Architect Mode 生成，随 handoff 传递给执行 Mode */
	acceptanceCriteria?: string[]
	/** 验收模式：执行完毕后是否需要回切 Architect 做验收 */
	validationMode?: "auto_return" | "manual_return" | "none"
}

/**
 * Handoff 注入格式：转成给模型的紧凑文本块。
 */
export interface ModeHandoffInjectFormat {
	/** 完整的 XML 块文本 */
	text: string
	/** 对应的 handoffId */
	handoffId: string
}
