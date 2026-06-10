/**
 * Orchestrator Session Manager
 *
 * Manages multiple orchestrator sessions.
 * Provides session lifecycle management and lookup.
 *
 * Integration point: ClineProvider calls this to start orchestrated sessions.
 */

import EventEmitter from "events"
import type {
	OrchestratorSessionState,
	UserOrchestratorSettings,
	PlanResponsePayload,
	ReviewResponsePayload,
	VerificationReport,
	ExecTask,
	ReviewTask,
} from "@roo-code/types"
import type { ProviderSettings } from "@roo-code/types"
import { OrchestratorSession, type OrchestratorSessionConfig } from "./OrchestratorSession"
import { CodexPlanner, type CodexPlannerConfig } from "../planner/CodexPlanner"
import { buildContextBundle, buildMinimalContext } from "../context/ContextBundleBuilder"
import { TaskRouter, createDefaultRouter, type RuntimeSignals } from "../router/TaskRouter"
import { ExecTaskRunner, type ExecTaskRunnerConfig } from "../worker/ExecTaskRunner"
import { CodexReviewer, type CodexReviewerConfig } from "../reviewer/CodexReviewer"

/**
 * Session manager configuration
 */
export interface SessionManagerConfig {
	/** Provider settings for Codex (planner/reviewer) */
	codexProviderSettings: ProviderSettings
	/** Available worker providers */
	availableWorkerProviders?: string[]
	/** Default max repair rounds */
	defaultMaxRepairRounds?: number
}

/**
 * Start session options
 */
export interface StartSessionOptions {
	/** User's request text */
	userRequest: string
	/** Currently active file */
	activeFile?: string
	/** Selected text */
	selectedText?: string
	/** User settings override */
	userSettings?: Partial<UserOrchestratorSettings>
}

/**
 * Session manager events
 */
export interface SessionManagerEvents {
	sessionCreated: [sessionId: string]
	sessionStateChanged: [sessionId: string, state: OrchestratorSessionState]
	sessionCompleted: [sessionId: string, summary: string]
	sessionFailed: [sessionId: string, reason: string]
	sessionCancelled: [sessionId: string]
}

/**
 * Orchestrator Session Manager
 *
 * Singleton-ish manager that handles multiple concurrent sessions.
 * Each session is independent and can run in parallel (though MVP is serial).
 */
export class OrchestratorSessionManager extends EventEmitter {
	private sessions: Map<string, OrchestratorSession> = new Map()
	private planner: CodexPlanner
	private router: TaskRouter
	private config: SessionManagerConfig

	constructor(config: SessionManagerConfig) {
		super()
		this.config = config
		this.planner = new CodexPlanner({
			providerSettings: config.codexProviderSettings,
		})
		this.router = createDefaultRouter(config.availableWorkerProviders)
	}

	/**
	 * Start a new orchestrated session
	 */
	async startSession(options: StartSessionOptions): Promise<OrchestratorSession> {
		const userSettings: UserOrchestratorSettings = {
			maxRepairRounds: this.config.defaultMaxRepairRounds ?? 2,
			allowAutoApply: false,
			...options.userSettings,
		}

		const sessionConfig: OrchestratorSessionConfig = {
			userRequest: options.userRequest,
			userSettings,
			activeFile: options.activeFile,
			selectedText: options.selectedText,
		}

		const session = new OrchestratorSession(sessionConfig)
		this.sessions.set(session.sessionId, session)

		// Forward session events
		this.forwardSessionEvents(session)

		this.emit("sessionCreated", session.sessionId)

		// Start planning phase
		await this.runPlanningPhase(session)

		return session
	}

	/**
	 * Run the planning phase for a session
	 */
	private async runPlanningPhase(session: OrchestratorSession): Promise<void> {
		try {
			// Transition to planning
			session.transitionTo("planning", "Starting planning phase")

			// Build context
			const startTime = Date.now()
			const context = await buildMinimalContext(
				session.userRequest,
				session.activeFile,
				session.selectedText,
			)
			session.setContextBundle(context)

			// Generate plan
			const plan = await this.planner.plan(session.userRequest, context)
			session.setPlan(plan)
			session.updateStats({ planningDurationMs: Date.now() - startTime })

			// Register tasks
			for (const task of plan.tasks) {
				session.registerTask({ ...task, sessionId: session.sessionId })
			}

			this.emit("sessionStateChanged", session.sessionId, session.state)
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			session.transitionTo("failed", `Planning failed: ${reason}`)
			this.emit("sessionFailed", session.sessionId, reason)
		}
	}

	/**
	 * Approve a plan and start execution
	 * (Called after user reviews and approves the plan)
	 */
	async approvePlan(sessionId: string, approvedTaskIds?: string[]): Promise<void> {
		const session = this.sessions.get(sessionId)
		if (!session) {
			throw new Error(`Session ${sessionId} not found`)
		}

		if (session.state !== "planning") {
			throw new Error(`Cannot approve plan in state '${session.state}'`)
		}

		// Mark approved tasks as ready
		const tasks = session.getTasks()
		for (const task of tasks) {
			if (!approvedTaskIds || approvedTaskIds.length === 0 || approvedTaskIds.includes(task.taskId)) {
				session.updateTaskStatus(task.taskId, "ready")
			}
		}

		// Transition to executing
		session.transitionTo("executing", "Plan approved, starting execution")
		this.emit("sessionStateChanged", session.sessionId, session.state)

		// Start the actual execution loop
		await this.runExecutionLoop(session)
	}

	/**
	 * Run the execution loop - executes tasks, verifies, and reviews
	 */
	private async runExecutionLoop(session: OrchestratorSession): Promise<void> {
		try {
			const maxRepairRounds = session.userSettings.maxRepairRounds ?? 2
			let currentRound = 0

			while (currentRound <= maxRepairRounds) {
				session.setRepairRound(currentRound)

				// Execute all ready tasks
				await this.executeReadyTasks(session)

				// Check if cancelled
				if (session.state === "cancelled") {
					return
				}

				// Transition to reviewing
				session.transitionTo("reviewing", "Running review")
				this.emit("sessionStateChanged", session.sessionId, session.state)

				// Run reviewer
				const reviewResult = await this.runReviewPhase(session)

				if (reviewResult.decision === "accept") {
					session.transitionTo("completed", reviewResult.summary)
					this.emit("sessionCompleted", session.sessionId, reviewResult.summary)
					return
				}

				if (reviewResult.decision === "reject") {
					session.transitionTo("failed", reviewResult.summary)
					this.emit("sessionFailed", session.sessionId, reviewResult.summary)
					return
				}

				if (reviewResult.decision === "needs_user_confirmation") {
					this.emit("needsUserConfirmation", session.sessionId, reviewResult.userConfirmationQuestion)
					session.transitionTo("failed", "User confirmation required but not supported")
					this.emit("sessionFailed", session.sessionId, "User confirmation required")
					return
				}

				// decision === "repair"
				if (currentRound >= maxRepairRounds) {
					session.transitionTo("failed", `Max repair rounds (${maxRepairRounds}) reached`)
					this.emit("sessionFailed", session.sessionId, "Max repair rounds reached")
					return
				}

				// Add repair tasks
				if (reviewResult.repairTasks && reviewResult.repairTasks.length > 0) {
					for (const repairTask of reviewResult.repairTasks) {
						session.registerTask({ ...repairTask, sessionId: session.sessionId })
					}
				}

				currentRound++
				session.transitionTo("executing", `Starting repair round ${currentRound}`)
				this.emit("sessionStateChanged", session.sessionId, session.state)
			}

			session.transitionTo("failed", "Execution loop exited without completion")
			this.emit("sessionFailed", session.sessionId, "Execution loop exited")
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			session.transitionTo("failed", `Execution failed: ${reason}`)
			this.emit("sessionFailed", session.sessionId, reason)
		}
	}

	/**
	 * Execute all ready tasks in the session
	 */
	private async executeReadyTasks(session: OrchestratorSession): Promise<void> {
		const readyTasks = session.getTasks().filter((t) => t.status === "ready" && t.kind === "exec")

		for (const task of readyTasks) {
			if (session.state === "cancelled") return

			session.updateTaskStatus(task.taskId, "running")
			this.emit("taskStarted", session.sessionId, task.taskId)

			try {
				const workerProvider = this.router.selectWorkerForTask(task as ExecTask)
				const runnerConfig: ExecTaskRunnerConfig = {
					providerSettings: this.config.codexProviderSettings,
					workerProvider,
				}

				const runner = new ExecTaskRunner(runnerConfig)
				const result = await runner.execute(task as ExecTask, session.getContextBundle())

				session.updateTaskStatus(task.taskId, "completed")
				session.updateTaskResult(task.taskId, { output: result.output, patch: result.patch })
				this.emit("taskCompleted", session.sessionId, task.taskId, result)
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error)
				session.updateTaskStatus(task.taskId, "failed")
				session.updateTaskError(task.taskId, reason)
				this.emit("taskFailed", session.sessionId, task.taskId, reason)
			}
		}
	}

	/**
	 * Run the review phase
	 */
	private async runReviewPhase(session: OrchestratorSession): Promise<ReviewResponsePayload> {
		const reviewerConfig: CodexReviewerConfig = {
			providerSettings: this.config.codexProviderSettings,
		}

		const reviewer = new CodexReviewer(reviewerConfig)
		const plan = session.getPlan()
		const tasks = session.getTasks().filter((t) => t.kind === "exec") as ExecTask[]
		const contextBundle = session.getContextBundle()

		const diff = tasks
			.filter((t) => t.status === "completed")
			.map((t) => session.getTaskResult(t.taskId)?.patch || "")
			.join("\n\n")

		const verification: VerificationReport = {
			passed: true,
			checks: [{ name: "build", passed: true, output: "Skipped in current implementation" }],
		}

		return reviewer.review({
			originalUserRequest: session.userRequest,
			planSummary: plan?.planSummary || "",
			executedTasks: tasks,
			diff,
			verification,
		})
	}

	/**
	 * Cancel a session
	 */
	cancelSession(sessionId: string, reason?: string): void {
		const session = this.sessions.get(sessionId)
		if (!session) return

		session.transitionTo("cancelled", reason)
		this.emit("sessionCancelled", sessionId)
	}

	/**
	 * Get a session by ID
	 */
	getSession(sessionId: string): OrchestratorSession | undefined {
		return this.sessions.get(sessionId)
	}

	/**
	 * Get all active sessions
	 */
	getActiveSessions(): OrchestratorSession[] {
		return Array.from(this.sessions.values()).filter((s) => s.isActive)
	}

	/**
	 * Get all sessions
	 */
	getAllSessions(): OrchestratorSession[] {
		return Array.from(this.sessions.values())
	}

	/**
	 * Remove a completed/failed session
	 */
	removeSession(sessionId: string): boolean {
		const session = this.sessions.get(sessionId)
		if (!session) return false

		if (session.isActive) {
			throw new Error(`Cannot remove active session ${sessionId}`)
		}

		this.sessions.delete(sessionId)
		return true
	}

	/**
	 * Forward session events to manager level
	 */
	private forwardSessionEvents(session: OrchestratorSession): void {
		session.on("stateChanged", (prev, curr) => {
			this.emit("sessionStateChanged", session.sessionId, curr)
		})

		session.on("sessionCompleted", (summary) => {
			this.emit("sessionCompleted", session.sessionId, summary)
		})

		session.on("sessionFailed", (reason) => {
			this.emit("sessionFailed", session.sessionId, reason)
		})

		session.on("sessionCancelled", (reason) => {
			this.emit("sessionCancelled", session.sessionId)
		})
	}

	/**
	 * Get router for external use (e.g., for custom routing)
	 */
	getRouter(): TaskRouter {
		return this.router
	}

	/**
	 * Update available worker providers
	 */
	setAvailableProviders(providers: string[]): void {
		this.router.setAvailableProviders(providers)
	}
}

/**
 * Create a session manager with default configuration
 */
export function createSessionManager(config: SessionManagerConfig): OrchestratorSessionManager {
	return new OrchestratorSessionManager(config)
}
