/**
 * Execution Report Service
 *
 * Generates structured execution reports after Code Mode completes its tasks.
 * The report is used to validate whether the implementation meets the
 * acceptance criteria defined by Architect Mode.
 *
 * @module mode-handoff/ExecutionReportService
 */

import type { ExecutionReport, ModeHandoffSummary } from "@roo-code/types"

/**
 * Input for generating an execution report.
 */
export interface ExecutionReportInput {
	/** The original handoff that initiated this execution */
	handoff: ModeHandoffSummary
	/** Current todo list after execution */
	todos: Array<{
		content?: string
		status?: string
		activeForm?: string
	}>
	/** Files that were modified during execution */
	modifiedFiles: string[]
	/** Recent assistant texts from the execution */
	recentAssistantTexts: string[]
}

/**
 * Generate a structured execution report from the execution state.
 *
 * This function:
 * 1. Extracts completed/incomplete items from todos
 * 2. Compares modified files against touched files from handoff
 * 3. Performs self-assessment against acceptance criteria
 * 4. Generates an overall summary
 *
 * @param input - The execution report input
 * @returns A structured execution report
 */
export function generateExecutionReport(input: ExecutionReportInput): ExecutionReport {
	const { handoff, todos, modifiedFiles, recentAssistantTexts } = input

	// Extract completed and incomplete items from todos
	const completedItems: string[] = []
	const incompleteItems: Array<{ item: string; reason: string }> = []

	for (const todo of todos) {
		const text = todo.content || todo.activeForm || ""
		if (!text) continue

		const status = todo.status?.toLowerCase()
		if (status === "completed") {
			completedItems.push(text)
		} else {
			incompleteItems.push({
				item: text,
				reason: status === "in_progress" ? "仍在进行中" : "未开始或状态未知",
			})
		}
	}

	// Detect deviations: items in handoff.pending that are not in completedItems
	const deviations: Array<{ planned: string; actual: string; reason: string }> = []
	for (const pendingItem of handoff.pending) {
		if (!completedItems.some((c) => c.includes(pendingItem) || pendingItem.includes(c))) {
			const incompleteMatch = incompleteItems.find((i) => i.item.includes(pendingItem) || pendingItem.includes(i.item))
			deviations.push({
				planned: pendingItem,
				actual: incompleteMatch ? `未完成: ${incompleteMatch.reason}` : "未在执行结果中找到对应项",
				reason: incompleteMatch?.reason || "执行结果中未覆盖此计划项",
			})
		}
	}

	// Self-assessment against acceptance criteria
	const selfAssessment: Array<{ criteria: string; met: boolean; evidence: string }> = []
	if (handoff.acceptanceCriteria && handoff.acceptanceCriteria.length > 0) {
		for (const criteria of handoff.acceptanceCriteria) {
			// Simple heuristic: check if criteria keywords appear in completed items or assistant texts
			const criteriaLower = criteria.toLowerCase()
			const allText = [...completedItems, ...recentAssistantTexts].join(" ").toLowerCase()

			const met = allText.includes(criteriaLower) || completedItems.length >= (handoff.pending.length || 0)
			selfAssessment.push({
				criteria,
				met,
				evidence: met
					? `在完成项或助手输出中找到相关内容`
					: `未在完成项或助手输出中找到明确对应内容`,
			})
		}
	}

	// Generate overall summary
	const allPassed = selfAssessment.length > 0 ? selfAssessment.every((s) => s.met) : incompleteItems.length === 0
	const overallSummary = allPassed
		? `执行完成。${completedItems.length} 项已完成，${incompleteItems.length} 项未完成。自评验收标准全部通过。`
		: `执行部分完成。${completedItems.length} 项已完成，${incompleteItems.length} 项未完成。${selfAssessment.filter((s) => !s.met).length} 项验收标准未通过。`

	return {
		handoffId: handoff.handoffId,
		createdAt: Date.now(),
		completedItems,
		incompleteItems,
		modifiedFiles,
		deviations,
		selfAssessment,
		overallSummary,
	}
}

/**
 * Format an execution report for injection into a mode handoff.
 *
 * @param report - The execution report to format
 * @returns XML block text for model injection
 */
export function formatExecutionReportForInjection(report: ExecutionReport): string {
	const lines: string[] = ["<execution_report>"]

	lines.push(`handoff_id: ${report.handoffId}`)

	if (report.completedItems.length > 0) {
		lines.push("completed_items:")
		for (const item of report.completedItems) {
			lines.push(`  - ${item}`)
		}
	}

	if (report.incompleteItems.length > 0) {
		lines.push("incomplete_items:")
		for (const item of report.incompleteItems) {
			lines.push(`  - ${item.item} (原因: ${item.reason})`)
		}
	}

	if (report.modifiedFiles.length > 0) {
		lines.push("modified_files:")
		for (const file of report.modifiedFiles) {
			lines.push(`  - ${file}`)
		}
	}

	if (report.deviations.length > 0) {
		lines.push("deviations:")
		for (const dev of report.deviations) {
			lines.push(`  - 计划: ${dev.planned} | 实际: ${dev.actual} | 原因: ${dev.reason}`)
		}
	}

	if (report.selfAssessment.length > 0) {
		lines.push("self_assessment:")
		for (const sa of report.selfAssessment) {
			lines.push(`  - [${sa.met ? "PASS" : "FAIL"}] ${sa.criteria}`)
			lines.push(`    证据: ${sa.evidence}`)
		}
	}

	lines.push(`overall_summary: ${report.overallSummary}`)
	lines.push("</execution_report>")

	return lines.join("\n")
}
