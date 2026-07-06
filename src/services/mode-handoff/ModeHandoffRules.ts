/**
 * Mode Handoff 规则
 *
 * 定义何时生成 handoff、何时不生成、如何消费。
 * 详见 docs/mode-handoff-summary-implementation-plan.md 第 6 节。
 */

import type { ModeHandoffTrigger } from "@roo-code/types"

/**
 * 判断是否应该生成 handoff。
 *
 * 生成条件（满足任一）：
 * 1. fromMode !== toMode（Mode 发生变化）
 * 2. fromProfile !== toProfile（Profile 发生变化，即使 Mode 不变）
 *
 * 不生成的情况：
 * - fromMode 和 toMode 都未设置（首次切换前）
 * - fromMode === toMode 且 fromProfile === toProfile（无变化）
 */
export function shouldCreateHandoff(params: {
	fromMode?: string
	toMode?: string
	fromProfile?: string
	toProfile?: string
}): boolean {
	const { fromMode, toMode, fromProfile, toProfile } = params

	// 首次切换前不生成（没有 fromMode/fromProfile）
	if (!fromMode && !fromProfile) {
		return false
	}

	// Mode 或 Profile 任一变化即生成
	const modeChanged = fromMode !== undefined && toMode !== undefined && fromMode !== toMode
	const profileChanged = fromProfile !== undefined && toProfile !== undefined && fromProfile !== toProfile

	return modeChanged || profileChanged
}

/**
 * 判断 handoff 是否已被消费（注入给模型后标记）。
 */
export function isHandoffConsumed(handoff: { consumedAt?: number }): boolean {
	return handoff.consumedAt !== undefined
}

/**
 * 判断触发类型。
 *
 * - Mode 变化 → "user_mode_switch"（当前仅支持用户主动切换）
 * - 仅 Profile 变化 → "profile_only_switch"
 * - 未来扩展：tool_switch_mode / auto_intent_switch
 */
export function determineTrigger(params: {
	fromMode?: string
	toMode?: string
	fromProfile?: string
	toProfile?: string
	/** 调用方显式指定的 trigger（优先使用） */
	explicitTrigger?: ModeHandoffTrigger
}): ModeHandoffTrigger {
	const { fromMode, toMode, fromProfile, toProfile, explicitTrigger } = params

	// 优先使用调用方显式指定的 trigger
	if (explicitTrigger) {
		return explicitTrigger
	}

	// 未指定时根据 mode/profile 变化推导
	const modeChanged = fromMode !== undefined && toMode !== undefined && fromMode !== toMode
	const profileChanged = fromProfile !== undefined && toProfile !== undefined && fromProfile !== toProfile

	if (modeChanged) {
		return "user_mode_switch"
	}
	if (profileChanged) {
		return "profile_only_switch"
	}
	// 默认回退
	return "user_mode_switch"
}

/**
 * 不触发 handoff 的情况（文档 6.2 节）：
 * - 只是用户打开旧 task
 * - provider 刷新了状态但没切 mode / profile
 * - 纯 UI 视图切换
 *
 * 这些情况由 shouldCreateHandoff 返回 false 覆盖。
 */
