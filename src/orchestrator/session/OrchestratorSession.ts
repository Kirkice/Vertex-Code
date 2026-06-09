/**
 * Orchestrator Session
 *
 * Manages the lifecycle of a single orchestrated request.
 * Coordinates planner, worker, verifier, and reviewer phases.
 *
 * This is the "编排控制器" that sits above Task/ClineProvider.
 */

import EventEmitter from "events"
import type {
	OrchestratorSessionState,
	OrchestratorTask,
	OrchestratorTaskStatus,
	ContextBundle,
	PlanResponsePayload,
	ReviewResponsePayload,
	VerificationReport,
	UserOrchestratorSettings,
	ReviewDecision,
	ExecTask,
} from "@roo-code/types"
import { OrchestratorStateMachine } from "./stateMachine"

/**
 * Session configuration
 */
export interface OrchestratorSessionConfig {
	/** User's original request */
	userRequest: string
	/** User settings for this session */
	userSettings: UserOrchestratorSettings
	/** Active file at session start */
	activeFile?: string
	/** Selected text at session start */
	selectedText?: string
}

/**
 * Session statistics
 */
export interface SessionStats {
	totalTokens: number
	tokensByProvider: Record<string, number>
	estimatedCostUsd: number
	planningDurationMs: number
	executionDurationMs: number
	verificationDurationMs: number
	reviewDurationMs: number
	repairRounds: number
}

/**
 * Default stats
 */
const DEFAULT_STATS: SessionStats = {
	totalTokens: 0,
	tokensByProvider: {},
	estimatedCostUsd: 0,
	planningDurationMs: 0,
	executionDurationMs: 0,
	verificationDurationMs: 0,
	reviewDurationMs: 0,
	repairRounds: 0,
}

/**
 * Session events
 */
export interface OrchestratorSessionEvents {
	stateChanged: [previousState: OrchestratorSessionState, currentState: OrchestratorSessionState]
	planGenerated: [plan: PlanResponsePayload]
	taskRegistered: [task: OrchestratorTask]
	taskStatusChanged: [taskId: string, status: OrchestratorTaskStatus]
	taskCompleted: [taskId: string, result?: unknown]
	verificationComplete: [report: VerificationReport]
	reviewComplete: [response: ReviewResponsePayload]
	repairStarted: [round: number]
	repairCompleted: [round: number]
	sessionCompleted: [summary: string]
	sessionFailed: [reason: string]
	sessionCancelled: [reason?: string]
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
	return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Orchestrator Session
 *
 * Represents a single orchestrated request from user.
 * Manages state transitions, task registration, and result aggregation.
 */
export class OrchestratorSession extends EventEmitter {
	readonly sessionId: string
	readonly userRequest: string
	readonly userSettings: UserOrchestratorSettings
	readonly activeFile?: string
	readonly selectedText?: string
	readonly createdAt: Date

	private stateMachine: OrchestratorStateMachine
	private tasks: Map<string, OrchestratorTask> = new Map()
	private contextBundle?: ContextBundle
	private plan?: PlanResponsePayload
	private verificationReport?: VerificationReport
	private reviewResponse?: ReviewResponsePayload
	private stats: SessionStats = { ...DEFAULT_STATS }

	constructor(config: OrchestratorSessionConfig) {
		super()
		this.sessionId = generateSessionId()
		this.userRequest = config.userRequest
		this.userSettings = config.userSettings
		this.activeFile = config.activeFile
		this.selectedText = config.selectedText
		this.createdAt = new Date()
		this.stateMachine = new OrchestratorStateMachine(config.userSettings.maxRepairRounds ?? 2)
	}

	// ============================================================================
	// State Access
	// ============================================================================

	/**
	 * Current session state
	 */
	get state(): OrchestratorSessionState {
		return this.stateMachine.state
	}

	/**
	 * Whether session is in terminal state
	 */
	get isTerminal(): boolean {
		return this.stateMachine.isTerminal
	}

	/**
	 * Whether session is active
	 */
	get isActive(): boolean {
		return this.stateMachine.isActive
	}

	/**
	 * Current repair round (0-indexed)
	 */
	get repairRound(): number {
		return this.stateMachine.repairRound
	}

	/**
	 * Maximum repair rounds
	 */
	get maxRepairRounds(): number {
		return this.stateMachine.maxRepairRounds
	}

	/**
	 * State transition history
	 */
	get history() {
		return this.stateMachine.history
	}

	/**
	 * Session statistics
	 */
	getStats(): Readonly<SessionStats> {
		return { ...this.stats }
	}

	// ============================================================================
	// State Transitions
	// ============================================================================

	/**
	 * Transition to a new state
	 */
	transitionTo(targetState: OrchestratorSessionState, reason?: string): boolean {
		const result = this.stateMachine.transition(targetState, reason)

		if (result.success) {
			this.emit("stateChanged", result.previousState, result.currentState)
		} else {
			console.warn(`[OrchestratorSession] State transition failed: ${result.reason}`)
		}

		return result.success
	}

	/**
	 * Transition based on review decision
	 */
	transitionFromReview(decision: ReviewDecision): boolean {
		const result = this.stateMachine.transitionFromReview(decision)

		if (result.success) {
			this.emit("stateChanged", result.previousState, result.currentState)

			if (result.currentState === "repairing") {
				this.stats.repairRounds++
				this.emit("repairStarted", this.repairRound)
			}
		}

		return result.success
	}

	// ============================================================================
	// Context & Plan
	// ============================================================================

	/**
	 * Set the context bundle for this session
	 */
	setContextBundle(bundle: ContextBundle): void {
		this.contextBundle = bundle
	}

	/**
	 * Get the context bundle
	 */
	getContextBundle(): ContextBundle | undefined {
		return this.contextBundle
	}

	/**
	 * Set the generated plan
	 */
	setPlan(plan: PlanResponsePayload): void {
		this.plan = plan
		this.emit("planGenerated", plan)
	}

	/**
	 * Get the plan
	 */
	getPlan(): PlanResponsePayload | undefined {
		return this.plan
	}

	// ============================================================================
	// Task Management
	// ============================================================================

	/**
	 * Register a task with this session
	 */
	registerTask(task: OrchestratorTask): void {
		this.tasks.set(task.taskId, { ...task, sessionId: this.sessionId })
		this.emit("taskRegistered", task)
	}

	/**
	 * Get a task by ID
	 */
	getTask(taskId: string): OrchestratorTask | undefined {
		return this.tasks.get(taskId)
	}

	/**
	 * Get all tasks
	 */
	getTasks(): OrchestratorTask[] {
		return Array.from(this.tasks.values())
	}

	/**
	 * Get tasks by status
	 */
	getTasksByStatus(status: OrchestratorTaskStatus): OrchestratorTask[] {
		return this.getTasks().filter((t) => t.status === status)
	}

	/**
	 * Get pending tasks (ready to execute)
	 */
	getPendingTasks(): OrchestratorTask[] {
		return this.getTasksByStatus("ready")
	}

	/**
	 * Update task status
	 */
	updateTaskStatus(taskId: string, status: OrchestratorTaskStatus): boolean {
		const task = this.tasks.get(taskId)
		if (!task) return false

		task.status = status
		task.updatedAt = new Date().toISOString()
		this.emit("taskStatusChanged", taskId, status)
		return true
	}

	/**
	 * Mark task as completed
	 */
	completeTask(taskId: string, result?: unknown): void {
		this.updateTaskStatus(taskId, "succeeded")
		this.emit("taskCompleted", taskId, result)
	}

	/**
	 * Mark task as failed
	 */
	failTask(taskId: string, error?: string): void {
		const task = this.tasks.get(taskId)
		if (task) {
			task.retryCount++
			if (task.retryCount >= task.maxRetries) {
				this.updateTaskStatus(taskId, "failed")
			} else {
				this.updateTaskStatus(taskId, "pending")
			}
		}
	}

	/**
	 * Add repair tasks
	 */
	addRepairTasks(tasks: ExecTask[]): void {
		for (const task of tasks) {
			this.registerTask({ ...task, kind: "repair", sessionId: this.sessionId })
		}
	}

	// ============================================================================
	// Verification & Review
	// ============================================================================

	/**
	 * Set verification report
	 */
	setVerificationReport(report: VerificationReport): void {
		this.verificationReport = report
		this.emit("verificationComplete", report)
	}

	/**
	 * Get verification report
	 */
	getVerificationReport(): VerificationReport | undefined {
		return this.verificationReport
	}

	/**
	 * Set review response
	 */
	setReviewResponse(response: ReviewResponsePayload): void {
		this.reviewResponse = response
		this.emit("reviewComplete", response)
	}

	/**
	 * Get review response
	 */
	getReviewResponse(): ReviewResponsePayload | undefined {
		return this.reviewResponse
	}

	// ============================================================================
	// Statistics
	// ============================================================================

	/**
	 * Update session statistics
	 */
	updateStats(updates: Partial<SessionStats>): void {
		Object.assign(this.stats, updates)
	}

	/**
	 * Add token usage
	 */
	addTokenUsage(provider: string, tokens: number): void {
		this.stats.totalTokens += tokens
		this.stats.tokensByProvider[provider] = (this.stats.tokensByProvider[provider] || 0) + tokens
	}

	// ============================================================================
	// Session Lifecycle
	// ============================================================================

	/**
	 * Complete the session successfully
	 */
	complete(summary: string): void {
		if (this.state !== "completed") {
			this.transitionTo("completed", summary)
		}
		this.emit("sessionCompleted", summary)
	}

	/**
	 * Fail the session
	 */
	fail(reason: string): void {
		if (this.state !== "failed") {
			this.transitionTo("failed", reason)
		}
		this.emit("sessionFailed", reason)
	}

	/**
	 * Cancel the session
	 */
	cancel(reason?: string): void {
		if (this.state !== "cancelled") {
			this.transitionTo("cancelled", reason)
		}
		this.emit("sessionCancelled", reason)
	}

	/**
	 * Get session summary for serialization
	 */
	toJSON(): Record<string, unknown> {
		return {
			sessionId: this.sessionId,
			userRequest: this.userRequest,
			state: this.state,
			createdAt: this.createdAt.toISOString(),
			repairRound: this.repairRound,
			maxRepairRounds: this.maxRepairRounds,
			tasks: this.getTasks(),
			plan: this.plan,
			verificationReport: this.verificationReport,
			reviewResponse: this.reviewResponse,
			stats: this.stats,
			history: this.history,
		}
	}
}