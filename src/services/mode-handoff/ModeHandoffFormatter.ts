/**
 * Mode Handoff Formatter
 *
 * 把结构化 ModeHandoffSummary 转成注入模型的紧凑文本块。
 * 详见 docs/mode-handoff-summary-implementation-plan.md 第 7.2 节。
 */

import type { ModeHandoffSummary } from "@roo-code/types"
import type { ModeHandoffInjectFormat } from "./ModeHandoffTypes"

/**
 * 把数组格式化为 YAML 列表项。
 */
function formatList(items: string[], indent = "  "): string {
	if (items.length === 0) return ""
	return items.map((item) => `${indent}- ${item}`).join("\n")
}

/**
 * 把结构化 handoff 转成注入给模型的 XML 文本块。
 *
 * 格式示例：
 * <mode_handoff>
 * from_mode: architect
 * to_mode: code
 * from_profile: GPT5.5
 * to_profile: qwen3.7
 * objective: 修复 marketplace 卡住刷新中的问题
 * completed:
 *   - 已确认 task/history 会保存 mode 与 profile
 *   - 已定位当前模式切换逻辑位于 Task.submitUserMessage
 * in_progress:
 *   - 正在实现稳定交接摘要
 * pending:
 *   - 新增 mode_handoff message schema
 *   - 在下一轮请求前注入 handoff context
 * constraints:
 *   - 不新增独立记忆系统
 *   - 不阻塞 UI
 * touched_files:
 *   - src/core/task/Task.ts
 *   - packages/types/src/message.ts
 * recommended_next_step: 继续实现 handoff 注入与测试
 * </mode_handoff>
 */
export function formatHandoffForInjection(handoff: ModeHandoffSummary): ModeHandoffInjectFormat {
	const lines: string[] = ["<mode_handoff>"]

	if (handoff.fromMode) lines.push(`from_mode: ${handoff.fromMode}`)
	lines.push(`to_mode: ${handoff.toMode}`)
	if (handoff.fromProfile) lines.push(`from_profile: ${handoff.fromProfile}`)
	if (handoff.toProfile) lines.push(`to_profile: ${handoff.toProfile}`)
	lines.push(`objective: ${handoff.objective}`)

	if (handoff.completed.length > 0) {
		lines.push("completed:")
		lines.push(formatList(handoff.completed))
	}

	if (handoff.inProgress.length > 0) {
		lines.push("in_progress:")
		lines.push(formatList(handoff.inProgress))
	}

	if (handoff.pending.length > 0) {
		lines.push("pending:")
		lines.push(formatList(handoff.pending))
	}

	if (handoff.constraints.length > 0) {
		lines.push("constraints:")
		lines.push(formatList(handoff.constraints))
	}

	if (handoff.touchedFiles.length > 0) {
		lines.push("touched_files:")
		lines.push(formatList(handoff.touchedFiles))
	}

	if (handoff.openQuestions.length > 0) {
		lines.push("open_questions:")
		lines.push(formatList(handoff.openQuestions))
	}

	if (handoff.recommendedNextStep) {
		lines.push(`recommended_next_step: ${handoff.recommendedNextStep}`)
	}

	if (handoff.acceptanceCriteria && handoff.acceptanceCriteria.length > 0) {
		lines.push("acceptance_criteria:")
		lines.push(formatList(handoff.acceptanceCriteria))
	}

	if (handoff.validationMode && handoff.validationMode !== "none") {
		lines.push(`validation_mode: ${handoff.validationMode}`)
	}

	lines.push("</mode_handoff>")

	return {
		text: lines.join("\n"),
		handoffId: handoff.handoffId,
	}
}

/**
 * 把 handoff 转成用户可读的卡片文本（用于 UI 展示）。
 */
export function formatHandoffForDisplay(handoff: ModeHandoffSummary): string {
	const parts: string[] = []

	const fromLabel = [handoff.fromMode, handoff.fromProfile].filter(Boolean).join(" · ")
	const toLabel = [handoff.toMode, handoff.toProfile].filter(Boolean).join(" · ")
	parts.push(`🔄 Mode Handoff: ${fromLabel || "?"} → ${toLabel}`)
	parts.push(`目标: ${handoff.objective}`)

	if (handoff.completed.length > 0) {
		parts.push(`已完成:\n${formatList(handoff.completed)}`)
	}
	if (handoff.inProgress.length > 0) {
		parts.push(`进行中:\n${formatList(handoff.inProgress)}`)
	}
	if (handoff.pending.length > 0) {
		parts.push(`待完成:\n${formatList(handoff.pending)}`)
	}
	if (handoff.recommendedNextStep) {
		parts.push(`下一步: ${handoff.recommendedNextStep}`)
	}

	return parts.join("\n\n")
}
