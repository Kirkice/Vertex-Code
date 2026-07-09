/**
 * Validation Service
 *
 * Handles the validation loop: after Code Mode completes, the execution report
 * is sent back to Architect Mode for validation against acceptance criteria.
 *
 * @module mode-handoff/ValidationService
 */

import type { ExecutionReport, ValidationResult, ModeHandoffSummary } from "@roo-code/types"

/**
 * Format a validation result for injection into a mode handoff.
 *
 * @param result - The validation result
 * @returns XML block text for model injection
 */
export function formatValidationResultForInjection(result: ValidationResult): string {
	const lines: string[] = ["<validation_result>"]

	lines.push(`handoff_id: ${result.handoffId}`)
	lines.push(`passed: ${result.passed}`)

	if (result.itemResults.length > 0) {
		lines.push("item_results:")
		for (const item of result.itemResults) {
			lines.push(`  - [${item.passed ? "PASS" : "FAIL"}] ${item.criteria}`)
			lines.push(`    备注: ${item.notes}`)
		}
	}

	if (result.repairInstructions && result.repairInstructions.length > 0) {
		lines.push("repair_instructions:")
		for (const instruction of result.repairInstructions) {
			lines.push(`  - ${instruction}`)
		}
	}

	lines.push(`summary: ${result.summary}`)
	lines.push("</validation_result>")

	return lines.join("\n")
}

/**
 * Determine if a validation result requires a repair cycle.
 *
 * @param result - The validation result
 * @returns True if the validation failed and repair instructions exist
 */
export function needsRepairCycle(result: ValidationResult): boolean {
	return !result.passed && (result.repairInstructions?.length ?? 0) > 0
}

/**
 * Build a repair handoff objective from a validation result.
 *
 * @param originalObjective - The original objective from the handoff
 * @param result - The validation result with repair instructions
 * @returns A new objective string for the repair cycle
 */
export function buildRepairObjective(
	originalObjective: string,
	result: ValidationResult,
): string {
	const failedItems = result.itemResults
		.filter((item) => !item.passed)
		.map((item) => item.criteria)

	const parts: string[] = []
	parts.push(`修复验收不通过项并重新完成: ${originalObjective}`)

	if (failedItems.length > 0) {
		parts.push(`未通过项: ${failedItems.join("; ")}`)
	}

	if (result.repairInstructions && result.repairInstructions.length > 0) {
		parts.push(`修复指令: ${result.repairInstructions.join("; ")}`)
	}

	return parts.join("\n")
}

/**
 * Check if a handoff requires auto-return validation.
 *
 * @param handoff - The handoff to check
 * @returns True if validationMode is "auto_return"
 */
export function requiresAutoReturn(handoff: ModeHandoffSummary): boolean {
	return handoff.validationMode === "auto_return"
}

/**
 * Check if a handoff has acceptance criteria defined.
 *
 * @param handoff - The handoff to check
 * @returns True if acceptance criteria exist and are non-empty
 */
export function hasAcceptanceCriteria(handoff: ModeHandoffSummary): boolean {
	return (handoff.acceptanceCriteria?.length ?? 0) > 0
}
