/**
 * Repair Loop
 *
 * Controls the repair cycle when reviewer requests fixes.
 * Managed by state machine - not by model free will.
 *
 * Key principles:
 * - Max 2 rounds by default
 * - Repair tasks inherit original allowedWritePaths
 * - Only fix reviewer-identified issues
 * - Re-verify after each repair
 */

import type { ExecTask, ReviewResponsePayload, ReviewFinding } from "@roo-code/types"
import { createTaskId } from "@roo-code/types"
import type { OrchestratorSession } from "./OrchestratorSession"

/**
 * Repair loop result
 */
export interface RepairLoopResult {
	shouldRepair: boolean
	repairTasks: ExecTask[]
	round: number
	maxRounds: number
	reason: string
}

/**
 * Evaluate whether repair should proceed
 */
export function evaluateRepairNeed(
	review: ReviewResponsePayload,
	currentRound: number,
	maxRounds: number,
): RepairLoopResult {
	// Already exhausted repair rounds
	if (currentRound >= maxRounds) {
		return {
			shouldRepair: false,
			repairTasks: [],
			round: currentRound,
			maxRounds,
			reason: `Exhausted ${maxRounds} repair rounds`,
		}
	}

	// No repair requested
	if (review.decision !== "repair") {
		return {
			shouldRepair: false,
			repairTasks: [],
			round: currentRound,
			maxRounds,
			reason: `Review decision was '${review.decision}', not 'repair'`,
		}
	}

	// No repair tasks provided by reviewer
	if (!review.repairTasks || review.repairTasks.length === 0) {
		// Generate repair tasks from findings
		const generatedTasks = generateRepairTasksFromFindings(review.findings, currentRound)
		return {
			shouldRepair: generatedTasks.length > 0,
			repairTasks: generatedTasks,
			round: currentRound,
			maxRounds,
			reason: generatedTasks.length > 0
				? `Generated ${generatedTasks.length} repair tasks from findings`
				: "No actionable findings to repair",
		}
	}

	return {
		shouldRepair: true,
		repairTasks: review.repairTasks,
		round: currentRound,
		maxRounds,
		reason: `Reviewer provided ${review.repairTasks.length} repair tasks`,
	}
}

/**
 * Generate repair tasks from review findings
 */
export function generateRepairTasksFromFindings(
	findings: ReviewFinding[],
	round: number,
): ExecTask[] {
	// Filter to actionable findings (high and medium severity)
	const actionableFindings = findings.filter((f) => f.severity === "high" || f.severity === "medium")

	if (actionableFindings.length === 0) {
		return []
	}

	// Group findings by file
	const findingsByFile = new Map<string, ReviewFinding[]>()
	for (const finding of actionableFindings) {
		const file = finding.file || "general"
		if (!findingsByFile.has(file)) {
			findingsByFile.set(file, [])
		}
		findingsByFile.get(file)!.push(finding)
	}

	// Create one repair task per file group
	const tasks: ExecTask[] = []
	const now = new Date().toISOString()

	for (const [file, fileFindings] of findingsByFile) {
		const task: ExecTask = {
			taskId: createTaskId("repair"),
			sessionId: "", // Will be set by session
			kind: "repair",
			title: `Fix ${fileFindings.length} issue(s) in ${file === "general" ? "project" : file}`,
			objective: fileFindings.map((f) => `[${f.severity}] ${f.message}`).join("\n"),
			status: "pending",
			priority: fileFindings.some((f) => f.severity === "high") ? 1 : 3,
			dependsOn: [],
			contextBundleIds: [],
			inputs: {
				findings: fileFindings,
				repairRound: round,
			},
			constraints: [],
			acceptanceCriteria: fileFindings.map((f, i) => ({
				id: `repair-ac-${round}-${i}`,
				description: `Fix: ${f.message}`,
				required: f.severity === "high",
			})),
			preferredModel: { provider: "auto", reasoningEffort: "medium" },
			retryCount: 0,
			maxRetries: 1,
			createdAt: now,
			updatedAt: now,
			allowedWritePaths: file === "general" ? [] : [file],
			expectedOutputs: ["patch"],
			riskLevel: fileFindings.some((f) => f.severity === "high") ? "high" : "medium",
		}
		tasks.push(task)
	}

	return tasks
}

/**
 * Execute repair loop for a session
 *
 * This is called by the session manager when review returns "repair".
 * It prepares the session for the next execution round.
 */
export function prepareRepairRound(
	session: OrchestratorSession,
	review: ReviewResponsePayload,
): RepairLoopResult {
	const result = evaluateRepairNeed(review, session.repairRound, session.maxRepairRounds)

	if (result.shouldRepair) {
		// Add repair tasks to session
		session.addRepairTasks(result.repairTasks)

		// Mark all repair tasks as ready
		for (const task of result.repairTasks) {
			session.updateTaskStatus(task.taskId, "ready")
		}

		// Transition to repairing state
		session.transitionFromReview("repair")
	}

	return result
}