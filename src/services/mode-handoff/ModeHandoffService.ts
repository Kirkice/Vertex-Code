/**
 * Mode Handoff Service
 *
 * 对外统一入口，负责创建、查询、消费、合并最新 handoff。
 * 详见 docs/mode-handoff-summary-implementation-plan.md 第 10.1 节。
 */

import type { ModeHandoffSummary, ClineMessage } from "@roo-code/types"
import type { ModeHandoffExtractInput, ModeHandoffInjectFormat } from "./ModeHandoffTypes"
import { extractHandoffSummary } from "./ModeHandoffExtractor"
import { formatHandoffForInjection } from "./ModeHandoffFormatter"
import { shouldCreateHandoff, isHandoffConsumed } from "./ModeHandoffRules"

/**
 * 创建一个 ModeHandoffSummary（如果应该生成）。
 *
 * @param input 提取输入
 * @returns ModeHandoffSummary 或 undefined（不应生成时）
 */
export function createHandoff(input: ModeHandoffExtractInput): ModeHandoffSummary | undefined {
	if (!shouldCreateHandoff({
		fromMode: input.fromMode,
		toMode: input.toMode,
		fromProfile: input.fromProfile,
		toProfile: input.toProfile,
		routingEnabled: input.routingEnabled,
	})) {
		return undefined
	}
	return extractHandoffSummary(input)
}

/**
 * 从 clineMessages 中获取最新的未消费 handoff。
 *
 * @param messages clineMessages 数组
 * @returns 最新未消费的 ModeHandoffSummary 或 undefined
 */
export function getLatestPendingHandoff(messages: ClineMessage[]): ModeHandoffSummary | undefined {
	// 从后往前找最新的未消费 handoff
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i]
		if (msg?.type === "say" && msg.say === "mode_handoff" && msg.modeHandoff) {
			if (!isHandoffConsumed(msg.modeHandoff)) {
				return msg.modeHandoff
			}
			// 找到最新的 handoff（无论是否消费），如果已消费则不再往前找
			break
		}
	}
	return undefined
}

/**
 * 消费 pending handoff：返回注入文本块，并标记 consumedAt。
 *
 * @param messages clineMessages 数组
 * @returns 注入文本块或 undefined（无 pending handoff 时）
 */
export function consumePendingHandoff(messages: ClineMessage[]): ModeHandoffInjectFormat | undefined {
	const handoff = getLatestPendingHandoff(messages)
	if (!handoff) {
		return undefined
	}

	// 标记为已消费
	handoff.consumedAt = Date.now()

	return formatHandoffForInjection(handoff)
}

/**
 * 把 handoff 转成 ClineMessage（say: "mode_handoff"）。
 *
 * 供 Task.addToClineMessages 使用。
 */
export function handoffToMessage(handoff: ModeHandoffSummary): ClineMessage {
	return {
		ts: handoff.createdAt,
		type: "say",
		say: "mode_handoff",
		text: undefined,
		modeHandoff: handoff,
	}
}
