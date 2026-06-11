/**
 * Orchestrator Engine — Mode Chain Controller
 *
 * Drives the orchestrator workflow by switching between Modes with
 * different model profiles for each stage.
 *
 * Stage = Mode + Model Profile:
 *   Planner  → Architect (read-only) + planner model  → analyze & plan
 *   Worker   → Code (read-write) + worker model       → execute plan
 *   Reviewer → Architect (read-only) + reviewer model  → review results
 *
 * Mode switching naturally handles simple vs complex requests:
 *   - "Hello" → Architect replies directly → done
 *   - "Integrate docs" → Architect plans → Worker executes → Reviewer checks
 *
 * This replaces the old CodexPlanner / ExecTaskRunner / CodexReviewer
 * components by reusing the existing Mode system's prompts, tools, and
 * agent loop infrastructure.
 */

import type { Task } from "./Task"
import type { OrchestratorModeConfig, OrchestratorModeState } from "@roo-code/types"

/**
 * Orchestrator Engine
 *
 * A lightweight Mode chain controller that orchestrates the workflow
 * by switching Modes and provider profiles on the host Task.
 */
export class OrchestratorEngine {
	private task: Task
	private config: OrchestratorModeConfig
	private state: OrchestratorModeState
	private cancelled = false

	constructor(task: Task, config: OrchestratorModeConfig) {
		this.task = task
		this.config = config
		this.state = {
			phase: "planning",
			repairRound: 0,
		}
	}

	/**
	 * Current orchestrator state (read-only snapshot)
	 */
	getState(): Readonly<OrchestratorModeState> {
		return { ...this.state }
	}

	/**
	 * Error message if orchestrator failed
	 */
	get error(): string | undefined {
		return this.state.error
	}

	/**
	 * Build orchestrator context block to inject into user messages.
	 * This tells the AI what role it's playing in the orchestrator workflow.
	 */
	private buildOrchestratorContext(role: "planner" | "worker" | "reviewer"): string {
		const roleDescriptions: Record<string, string> = {
			planner: "你是编排器的**规划者 (Planner)**。你的职责是分析用户的任务需求，制定执行计划。如果任务简单，可以直接回复；如果任务复杂，请输出详细的执行计划供后续阶段执行。",
			worker: "你是编排器的**执行者 (Worker)**。你的职责是按照规划者制定的计划，执行具体的代码修改和操作。请仔细阅读计划，逐步完成每个任务步骤。",
			reviewer: "你是编排器的**审核者 (Reviewer)**。你的职责是审查执行者的工作成果，确认计划是否被正确实施。如果一切正常，请回复 'REVIEW_PASSED'；如果有问题，请回复 'REVIEW_FAILED' 并详细说明需要修复的内容。",
		}

		return `<orchestrator_context>
<role>${role}</role>
<description>${roleDescriptions[role]}</description>
<workflow>编排器工作流程：规划者 (Planner) → 执行者 (Worker) → 审核者 (Reviewer)。当前阶段：${role}。</workflow>
</orchestrator_context>`
	}

	/**
	 * Run the orchestrator — Phase 1: Planner
	 *
	 * Switches to the Planner's Mode + model and lets the agent loop run.
	 * The Architect Mode will either:
	 *   - Reply directly (simple task) → completes the task
	 *   - Output a plan (complex task) → we intercept and wait for approval
	 */
	async run(userMessage: string): Promise<void> {
		try {
			this.state.phase = "planning"

			// Switch to Planner Mode + model
			const provider = this.task.getProvider()
			await provider.setMode(this.config.planner.mode)
			await provider.setProviderProfile(this.config.planner.profile)

			this.task.log(
				`[Orchestrator] Planner stage: mode=${this.config.planner.mode}, profile=${this.config.planner.profile}`,
			)

			// Inject orchestrator context so the AI knows its role
			const orchestratorContext = this.buildOrchestratorContext("planner")

			// Run the agent loop — Architect will handle the request naturally.
			// For simple tasks, Architect replies directly and the task completes.
			// For complex tasks, Architect will output a plan using attempt_completion.
			await this.task.recursivelyMakeClineRequests(
				[{ type: "text", text: `${orchestratorContext}\n\n<user_message>\n${userMessage}\n</user_message>` }],
				true, // includeFileDetails
			)

			if (this.cancelled) return

			// After the Planner finishes, check if it called attempt_completion.
			// If the task's last message is attempt_completion, the Planner
			// decided this was simple enough to answer directly → we're done.
			const lastMessage = this.task.clineMessages[this.task.clineMessages.length - 1]
			if (lastMessage?.ask === "completion_result" || lastMessage?.say === "completion_result") {
				// Planner replied directly — task is complete
				this.state.phase = "completed"
				return
			}

			// Planner outputted a plan — wait for user approval
			this.state.phase = "awaiting_approval"
			// Execution continues in approvePlan() when user clicks "Approve"
		} catch (error) {
			this.state.phase = "failed"
			this.state.error = error instanceof Error ? error.message : String(error)
			await this.task.sayWithOrchestratorMeta("error", `Orchestrator planning failed: ${this.state.error}`, {
				orchestratorRole: "planner",
				orchestratorModelId: this.config.planner.profile,
			})
		}
	}

	/**
	 * Approve the plan and start Worker + Reviewer stages.
	 * Called by Task when user clicks "Approve Plan".
	 */
	async approvePlan(): Promise<void> {
		if (this.state.phase !== "awaiting_approval") {
			throw new Error(`Cannot approve plan in phase '${this.state.phase}'`)
		}

		try {
			await this.runWorkerStage()

			if (this.cancelled) return

			await this.runReviewerStage()
		} catch (error) {
			this.state.phase = "failed"
			this.state.error = error instanceof Error ? error.message : String(error)
			await this.task.sayWithOrchestratorMeta("error", `Orchestrator execution failed: ${this.state.error}`, {
				orchestratorRole: "worker",
				orchestratorModelId: this.config.worker.profile,
			})
		}
	}

	/**
	 * Cancel the orchestrator run
	 */
	cancel(): void {
		this.cancelled = true
		this.state.phase = "failed"
		this.state.error = "Cancelled by user"
	}

	// ============================================================================
	// Private: Worker Stage
	// ============================================================================

	/**
	 * Switch to Worker Mode + model and execute the plan.
	 * The Code Mode agent will read the plan from conversation history
	 * and execute it using its full tool set (read/write files, run commands).
	 */
	private async runWorkerStage(): Promise<void> {
		this.state.phase = "executing"

		const provider = this.task.getProvider()
		await provider.setMode(this.config.worker.mode)
		await provider.setProviderProfile(this.config.worker.profile)

		this.task.log(
			`[Orchestrator] Worker stage: mode=${this.config.worker.mode}, profile=${this.config.worker.profile}`,
		)

		await this.task.sayWithOrchestratorMeta("text", "⚡ **执行者正在按照计划执行...**", {
			orchestratorRole: "worker",
			orchestratorModelId: this.config.worker.profile,
		})

		// Inject orchestrator context so the AI knows its role
		const orchestratorContext = this.buildOrchestratorContext("worker")

		// Run the agent loop — Code Mode agent will execute the plan
		// using its conversation history (which includes the Planner's output)
		await this.task.recursivelyMakeClineRequests(
			[{ type: "text", text: `${orchestratorContext}\n\n请按照上方的执行计划，阅读相关文件，进行必要的修改，并完成计划中概述的所有任务。` }],
			false, // no need for file details again
		)
	}

	// ============================================================================
	// Private: Reviewer Stage
	// ============================================================================

	/**
	 * Switch to Reviewer Mode + model and review the execution results.
	 * The Architect Mode agent will read the conversation history
	 * (plan + execution) and provide a review assessment.
	 *
	 * If review passes → completed
	 * If review fails → back to Worker (up to maxRepairRounds)
	 */
	private async runReviewerStage(): Promise<void> {
		const maxRounds = this.config.maxRepairRounds ?? 2

		while (this.state.repairRound <= maxRounds) {
			this.state.phase = "reviewing"

			const provider = this.task.getProvider()
			await provider.setMode(this.config.reviewer.mode)
			await provider.setProviderProfile(this.config.reviewer.profile)

			this.task.log(
				`[Orchestrator] Reviewer stage: mode=${this.config.reviewer.mode}, profile=${this.config.reviewer.profile}`,
			)

			await this.task.sayWithOrchestratorMeta("text", "🔍 **审核者正在审查执行结果...**", {
				orchestratorRole: "reviewer",
				orchestratorModelId: this.config.reviewer.profile,
			})

			// Inject orchestrator context so the AI knows its role
			const orchestratorContext = this.buildOrchestratorContext("reviewer")

			// Run the agent loop — Architect will review the execution
			await this.task.recursivelyMakeClineRequests(
				[{ type: "text", text: `${orchestratorContext}\n\n请审查上方的执行结果，确认计划是否被正确实施。如果一切正常，请回复 'REVIEW_PASSED'。如果存在问题需要修复，请回复 'REVIEW_FAILED' 并详细说明具体问题。` }],
				false,
			)

			if (this.cancelled) return

			// Check the reviewer's response
			const reviewResult = this.extractReviewResult()

			if (reviewResult === "passed") {
				this.state.phase = "completed"
				await this.task.sayWithOrchestratorMeta("text", "### ✅ 审核通过", {
					orchestratorRole: "reviewer",
					orchestratorModelId: this.config.reviewer.profile,
				})
				return
			}

			// Review failed — check if we can repair
			if (this.state.repairRound >= maxRounds) {
				this.state.phase = "failed"
				this.state.error = `Max repair rounds (${maxRounds}) reached`
				await this.task.sayWithOrchestratorMeta(
					"text",
					`### ⚠️ 修复轮次上限\n\n已达到最大修复轮次 (${maxRounds})，任务终止。`,
					{
						orchestratorRole: "reviewer",
						orchestratorModelId: this.config.reviewer.profile,
					},
				)
				return
			}

			this.state.repairRound++
			this.state.phase = "repairing"
			await this.task.sayWithOrchestratorMeta(
				"text",
				`### 🔄 修复轮次 ${this.state.repairRound}/${maxRounds}\n\n审核者发现问题，切换回执行者进行修复...`,
				{
					orchestratorRole: "reviewer",
					orchestratorModelId: this.config.reviewer.profile,
				},
			)

			// Back to Worker for repair
			await this.runWorkerStage()

			if (this.cancelled) return
		}

		this.state.phase = "failed"
		this.state.error = "Execution loop exited without completion"
	}

	/**
	 * Extract review result from the reviewer's last messages.
	 * Looks for REVIEW_PASSED or REVIEW_FAILED markers in the conversation.
	 */
	private extractReviewResult(): "passed" | "failed" {
		// Scan recent messages for review markers
		const recentMessages = this.task.clineMessages.slice(-10)

		for (const msg of recentMessages) {
			const text = (msg.text || "").toLowerCase()
			if (text.includes("review_passed") || text.includes("审核通过") || text.includes("everything looks good")) {
				return "passed"
			}
			if (text.includes("review_failed") || text.includes("审核不通过") || text.includes("issues that need")) {
				return "failed"
			}
		}

		// Default: if attempt_completion was called, consider it passed
		const lastMessage = this.task.clineMessages[this.task.clineMessages.length - 1]
		if (lastMessage?.ask === "completion_result" || lastMessage?.say === "completion_result") {
			return "passed"
		}

		// If we can't determine, default to passed (optimistic)
		return "passed"
	}
}