/**
 * Orchestrator Engine
 *
 * Core orchestrator logic extracted from the old OrchestratorSessionManager.
 * Runs inside a Task instance — does NOT manage sessions or messages directly.
 * All UI output goes through task.say() with orchestratorRole + orchestratorModelId.
 *
 * Flow:
 *   1. Planning:   Planner profile → generate plan or direct response
 *   2. Approval:   Wait for user to approve the plan
 *   3. Execution:  Worker profile → execute sub-tasks
 *   4. Review:     Reviewer profile → review results
 *   5. Repair:     If reviewer rejects → back to Worker (max N rounds)
 */

import type { Task } from "./Task"
import type { OrchestratorModeConfig, OrchestratorModeState } from "@roo-code/types"
import type {
	OrchestratorTask,
	PlanResponsePayload,
	ExecTask,
	ReviewResponsePayload,
	ProviderSettings,
	VerifyResponsePayload,
	CommandResult,
} from "@roo-code/types"
import { CodexPlanner, type CodexPlannerConfig, type PlannerResult } from "../../orchestrator/planner/CodexPlanner"
import { buildMinimalContext } from "../../orchestrator/context/ContextBundleBuilder"
import { ExecTaskRunner, type ExecTaskRunnerConfig } from "../../orchestrator/worker/ExecTaskRunner"
import { CodexReviewer, type CodexReviewerConfig } from "../../orchestrator/reviewer/CodexReviewer"
import { createDefaultRouter } from "../../orchestrator/router/TaskRouter"
import {
	createVerificationRunner,
	determineVerificationProfile,
} from "../../orchestrator/verifier/VerificationRunner"

/**
 * Orchestrator Engine
 *
 * Drives the Plan → Approve → Execute → Review → Repair loop
 * within a Task instance.
 */
export class OrchestratorEngine {
	private task: Task
	private config: OrchestratorModeConfig
	private state: OrchestratorModeState
	private planner?: CodexPlanner
	private reviewer?: CodexReviewer
	private cancelled = false

	constructor(task: Task, config: OrchestratorModeConfig) {
		this.task = task
		this.config = config
		this.state = {
			phase: "planning",
			repairRound: 0,
			tasks: [],
		}
	}

	/**
	 * Current orchestrator state (read-only snapshot)
	 */
	getState(): Readonly<OrchestratorModeState> {
		return { ...this.state }
	}

	/**
	 * Whether the planner produced a direct response (simple task)
	 */
	get isDirectResponse(): boolean {
		return !!this.state.directResponse
	}

	/**
	 * The direct response text (if any)
	 */
	get directResponse(): string | undefined {
		return this.state.directResponse
	}

	/**
	 * The generated plan (if any)
	 */
	get plan(): PlanResponsePayload | undefined {
		return this.state.plan
	}

	/**
	 * Sub-tasks from the plan
	 */
	get tasks(): OrchestratorTask[] {
		return this.state.tasks
	}

	/**
	 * Error message if orchestrator failed
	 */
	get error(): string | undefined {
		return this.state.error
	}

	/**
	 * Run the full orchestrator loop.
	 *
	 * @param userMessage - The user's original request
	 */
	async run(userMessage: string): Promise<void> {
		try {
			// Phase 1: Planning
			await this.runPlanningPhase(userMessage)

			if (this.cancelled) return

			// If planner gave a direct response, we're done
			if (this.state.directResponse) {
				this.state.phase = "completed"
				return
			}

			// Phase 2: Wait for user approval
			this.state.phase = "awaiting_approval"
			// The Task will call approvePlan() when user clicks "Approve"
			// We return here; execution continues in approvePlan()
		} catch (error) {
			this.state.phase = "failed"
			this.state.error = error instanceof Error ? error.message : String(error)
			await this.task.sayWithOrchestratorMeta("error", `Orchestrator planning failed: ${this.state.error}`, {
				orchestratorRole: "planner",
				orchestratorModelId: this.config.plannerProfile,
			})
		}
	}

	/**
	 * Approve the plan and start execution.
	 * Called by Task when user clicks "Approve Plan".
	 */
	async approvePlan(): Promise<void> {
		if (this.state.phase !== "awaiting_approval") {
			throw new Error(`Cannot approve plan in phase '${this.state.phase}'`)
		}

		try {
			// Mark all tasks as ready
			for (const task of this.state.tasks) {
				task.status = "ready"
			}

			// Start execution loop
			await this.runExecutionLoop()
		} catch (error) {
			this.state.phase = "failed"
			this.state.error = error instanceof Error ? error.message : String(error)
			await this.task.sayWithOrchestratorMeta("error", `Orchestrator execution failed: ${this.state.error}`, {
				orchestratorRole: "worker",
				orchestratorModelId: this.config.workerProfile,
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
	// Private: Planning Phase
	// ============================================================================

	private async runPlanningPhase(userMessage: string): Promise<void> {
		this.state.phase = "planning"

		const plannerSettings = await this.resolveProfileSettings(this.config.plannerProfile)
		const plannerConfig: CodexPlannerConfig = {
			providerSettings: plannerSettings,
		}
		this.planner = new CodexPlanner(plannerConfig)

		const context = await buildMinimalContext(userMessage)

		await this.task.sayWithOrchestratorMeta("text", "🧠 **计划者正在分析任务...**", {
			orchestratorRole: "planner",
			orchestratorModelId: this.config.plannerProfile,
		})

		const result: PlannerResult = await this.planner.plan(userMessage, context)

		if (result.type === "direct") {
			// Simple task: direct answer
			this.state.directResponse = result.text
			await this.task.sayWithOrchestratorMeta("text", result.text, {
				orchestratorRole: "planner",
				orchestratorModelId: this.config.plannerProfile,
			})
		} else {
			// Complex task: set plan and register sub-tasks
			this.state.plan = result.plan
			this.state.tasks = result.plan.tasks.map((t) => ({
				...t,
				sessionId: this.task.taskId,
			}))

			const taskList = result.plan.tasks
				.map((t, i) => `${i + 1}. **${t.title}** — ${t.objective}`)
				.join("\n")

			await this.task.sayWithOrchestratorMeta(
				"text",
				`### 📋 任务计划\n\n**${result.plan.planSummary}**\n\n${taskList}\n\n> 点击 "Approve Plan" 开始执行`,
				{
					orchestratorRole: "planner",
					orchestratorModelId: this.config.plannerProfile,
				},
			)
		}
	}

	// ============================================================================
	// Private: Execution Loop
	// ============================================================================

	private async runExecutionLoop(): Promise<void> {
		const maxRounds = this.config.maxRepairRounds ?? 2

		while (this.state.repairRound <= maxRounds) {
			if (this.cancelled) return

			// Execute all ready tasks
			this.state.phase = "executing"
			await this.executeReadyTasks()

			if (this.cancelled) return

			// Review phase
			this.state.phase = "reviewing"
			const reviewResult = await this.runReviewPhase()

			if (this.cancelled) return

			if (reviewResult.decision === "accept") {
				this.state.phase = "completed"
				await this.task.sayWithOrchestratorMeta("text", `### ✅ 审核通过\n\n${reviewResult.summary}`, {
					orchestratorRole: "reviewer",
					orchestratorModelId: this.config.reviewerProfile,
				})
				return
			}

			if (reviewResult.decision === "reject") {
				this.state.phase = "failed"
				this.state.error = `Review rejected: ${reviewResult.summary}`
				await this.task.sayWithOrchestratorMeta("text", `### 🚫 审核拒绝\n\n${reviewResult.summary}`, {
					orchestratorRole: "reviewer",
					orchestratorModelId: this.config.reviewerProfile,
				})
				return
			}

			// decision === "repair"
			if (this.state.repairRound >= maxRounds) {
				this.state.phase = "failed"
				this.state.error = `Max repair rounds (${maxRounds}) reached`
				await this.task.sayWithOrchestratorMeta(
					"text",
					`### ⚠️ 修复轮次上限\n\n已达到最大修复轮次 (${maxRounds})，任务终止。`,
					{
						orchestratorRole: "reviewer",
						orchestratorModelId: this.config.reviewerProfile,
					},
				)
				return
			}

			this.state.repairRound++
			this.state.phase = "repairing"
			await this.task.sayWithOrchestratorMeta(
				"text",
				`### 🔄 修复轮次 ${this.state.repairRound}/${maxRounds}\n\n${reviewResult.summary}`,
				{
					orchestratorRole: "reviewer",
					orchestratorModelId: this.config.reviewerProfile,
				},
			)

			// Add repair tasks from reviewer feedback
			if (reviewResult.repairTasks?.length) {
				for (const repairTask of reviewResult.repairTasks) {
					this.state.tasks.push({ ...repairTask, sessionId: this.task.taskId, status: "ready" })
				}
			}
		}

		this.state.phase = "failed"
		this.state.error = "Execution loop exited without completion"
	}

	private async executeReadyTasks(): Promise<void> {
		const readyTasks = this.state.tasks.filter(
			(t) => t.status === "ready" && (t.kind === "exec" || t.kind === "repair"),
		)
		const total = readyTasks.length

		for (let i = 0; i < readyTasks.length; i++) {
			if (this.cancelled) return

			const orchestratorTask = readyTasks[i]
			orchestratorTask.status = "running"

			await this.task.sayWithOrchestratorMeta("text", `⚡ 正在执行：任务 **${i + 1}/${total}** — ${orchestratorTask.title}`, {
				orchestratorRole: "worker",
				orchestratorModelId: this.config.workerProfile,
			})

			try {
				const context = await buildMinimalContext(orchestratorTask.objective)
				const router = createDefaultRouter([this.config.workerProfile ?? "default"])
				const runnerConfig: ExecTaskRunnerConfig = {
					router,
					getProviderSettings: (profileName: string) => {
						return this.task.getCurrentProviderSettings()
					},
					createTaskFn: async (text: string, images?: string[], parentTask?: unknown, options?: any) => {
						const provider = this.task.getProvider()
						const task = await provider.createTask(text, images, parentTask as any, options)
						return {
							taskId: task.taskId,
							waitForCompletion: async () => {
								// Wait for task to complete by polling its status
								return new Promise<{ success: boolean; diff?: string; changedFiles: string[]; summary: string }>((resolve) => {
									const checkInterval = setInterval(() => {
										if (task.taskStatus === "idle" || task.taskStatus === "none") {
											clearInterval(checkInterval)
											resolve({
												success: true,
												diff: "",
												changedFiles: [],
												summary: "Task completed",
											})
										}
									}, 1000)
									// Timeout after 5 minutes
									setTimeout(() => {
										clearInterval(checkInterval)
										resolve({
											success: false,
											diff: "",
											changedFiles: [],
											summary: "Task timed out",
										})
									}, 300000)
								})
							},
						}
					},
				}
				const runner = new ExecTaskRunner(runnerConfig)
				const result = await runner.execute(orchestratorTask as ExecTask, context)

				if (result.success) {
					orchestratorTask.status = "succeeded"
				} else {
					orchestratorTask.status = "failed"
				}
			} catch (error) {
				orchestratorTask.retryCount++
				if (orchestratorTask.retryCount >= orchestratorTask.maxRetries) {
					orchestratorTask.status = "failed"
				} else {
					orchestratorTask.status = "ready"
				}
			}
		}
	}

	// ============================================================================
	// Private: Review Phase
	// ============================================================================

	private async runReviewPhase(): Promise<ReviewResponsePayload> {
		const reviewerSettings = await this.resolveProfileSettings(this.config.reviewerProfile)
		const reviewerConfig: CodexReviewerConfig = {
			providerSettings: reviewerSettings,
		}
		this.reviewer = new CodexReviewer(reviewerConfig)

		await this.task.sayWithOrchestratorMeta("text", "🔍 **审核者正在审查执行结果...**", {
			orchestratorRole: "reviewer",
			orchestratorModelId: this.config.reviewerProfile,
		})

		const execTasks = this.state.tasks.filter(
			(t) => t.kind === "exec" || t.kind === "repair",
		) as ExecTask[]

		// Run verification for each succeeded exec task
		const runner = createVerificationRunner(this.task.cwd)
		const allCommandResults: CommandResult[] = []
		let overallStatus: "passed" | "failed" | "partial" = "passed"

		const succeededTasks = execTasks.filter((t) => t.status === "succeeded")
		if (succeededTasks.length > 0) {
			await this.task.sayWithOrchestratorMeta("text", "🔧 **正在运行验证检查...**", {
				orchestratorRole: "reviewer",
				orchestratorModelId: this.config.reviewerProfile,
			})

			for (const task of succeededTasks) {
				const profile = determineVerificationProfile(task)
				try {
					const report = await runner.verify(task.taskId, this.task.taskId, [], profile)
					allCommandResults.push(...report.commandResults)
					if (report.status === "failed") {
						overallStatus = "failed"
					} else if (report.status === "partial" && overallStatus !== "failed") {
						overallStatus = "partial"
					}
				} catch (error) {
					allCommandResults.push({
						reportId: "",
						sessionId: this.task.taskId,
						command: `verification for ${task.taskId}`,
						exitCode: -1,
						summary: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
						generatedAt: new Date().toISOString(),
					} as any)
					overallStatus = "failed"
				}
			}
		}

		const passedCount = allCommandResults.filter((r) => r.exitCode === 0).length
		const verification: VerifyResponsePayload = {
			type: "verify.response",
			taskId: this.task.taskId,
			overallStatus,
			commandResults: allCommandResults.length > 0
				? allCommandResults.map((r) => ({
					command: r.command,
					exitCode: r.exitCode,
					stdout: "",
					stderr: "",
					durationMs: 0,
				}))
				: [{ command: "skip", exitCode: 0, stdout: "", stderr: "", durationMs: 0 }],
			summary: allCommandResults.length > 0
				? `${passedCount}/${allCommandResults.length} checks passed (${overallStatus})`
				: "No verification commands executed",
		}

		return this.reviewer.review({
			originalUserRequest: this.task.metadata.task ?? "",
			planSummary: this.state.plan?.planSummary ?? "",
			executedTasks: execTasks,
			diff: "",
			verification,
		})
	}

	// ============================================================================
	// Private: Helpers
	// ============================================================================

	/**
	 * Resolve a named provider profile into provider settings.
	 * Falls back to the current Task's provider settings if profile not found.
	 */
	private async resolveProfileSettings(profileName?: string): Promise<ProviderSettings> {
		if (!profileName) {
			// Fallback: use the Task's current provider settings
			return this.task.getCurrentProviderSettings()
		}

		try {
			// Access provider settings manager through the task's provider reference
			const provider = this.task.getProvider()
			const profile = await provider.providerSettingsManager.getProfile({ name: profileName })
			const { name: _name, id: _id, ...providerSettings } = profile
			return providerSettings as ProviderSettings
		} catch (error) {
			this.task.log(
				`[Orchestrator] Failed to resolve profile '${profileName}': ${error instanceof Error ? error.message : String(error)}`,
			)
			// Fallback to current settings
			return this.task.getCurrentProviderSettings()
		}
	}
}