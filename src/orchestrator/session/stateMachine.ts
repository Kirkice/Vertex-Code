/**
 * Orchestrator State Machine
 *
 * Controls the lifecycle of an orchestrated session.
 * State transitions are explicit and deterministic - no model-driven flow control.
 *
 * State flow:
 *   created -> planning -> executing -> verifying -> reviewing -> completed
 *                                                       |
 *                                                       v
 *                                                   repairing -> executing (loop, max 2 rounds)
 *                                                       |
 *                                                       v
 *                                                     failed
 */

import type { OrchestratorSessionState, ReviewDecision } from "@roo-code/types"

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<OrchestratorSessionState, OrchestratorSessionState[]> = {
	created: ["planning", "cancelled"],
	planning: ["executing", "failed", "cancelled"],
	executing: ["verifying", "failed", "cancelled"],
	verifying: ["reviewing", "failed", "cancelled"],
	reviewing: ["completed", "repairing", "failed", "cancelled"],
	repairing: ["executing", "failed", "cancelled"],
	completed: [],
	failed: [],
	cancelled: [],
}

/**
 * State transition result
 */
export interface StateTransitionResult {
	success: boolean
	previousState: OrchestratorSessionState
	currentState: OrchestratorSessionState
	reason?: string
}

/**
 * Determine the next state based on review decision and repair rounds
 */
export function resolveNextState(
	reviewDecision: ReviewDecision,
	currentRepairRound: number,
	maxRepairRounds: number,
): OrchestratorSessionState {
	if (reviewDecision === "accept") {
		return "completed"
	}

	if (reviewDecision === "needs_user_confirmation") {
		// Pause and wait for user input - stay in reviewing until user responds
		return "reviewing"
	}

	if (reviewDecision === "reject") {
		return "failed"
	}

	// reviewDecision === "repair"
	if (currentRepairRound < maxRepairRounds) {
		return "repairing"
	}

	// Exhausted repair rounds
	return "failed"
}

/**
 * Orchestrator state machine
 *
 * Manages state transitions for a single orchestrated session.
 * Thread-safe by design (single session per instance).
 */
export class OrchestratorStateMachine {
	private _state: OrchestratorSessionState = "created"
	private _repairRound: number = 0
	private _maxRepairRounds: number
	private _transitionHistory: Array<{
		from: OrchestratorSessionState
		to: OrchestratorSessionState
		timestamp: string
		reason?: string
	}> = []

	constructor(maxRepairRounds: number = 2) {
		this._maxRepairRounds = maxRepairRounds
	}

	/**
	 * Current state
	 */
	get state(): OrchestratorSessionState {
		return this._state
	}

	/**
	 * Current repair round (0-indexed)
	 */
	get repairRound(): number {
		return this._repairRound
	}

	/**
	 * Maximum repair rounds allowed
	 */
	get maxRepairRounds(): number {
		return this._maxRepairRounds
	}

	/**
	 * Whether the session is in a terminal state
	 */
	get isTerminal(): boolean {
		return this._state === "completed" || this._state === "failed" || this._state === "cancelled"
	}

	/**
	 * Whether the session is active (not terminal)
	 */
	get isActive(): boolean {
		return !this.isTerminal
	}

	/**
	 * Transition history
	 */
	get history(): ReadonlyArray<{
		from: OrchestratorSessionState
		to: OrchestratorSessionState
		timestamp: string
		reason?: string
	}> {
		return this._transitionHistory
	}

	/**
	 * Attempt to transition to a new state
	 */
	transition(targetState: OrchestratorSessionState, reason?: string): StateTransitionResult {
		const validTargets = VALID_TRANSITIONS[this._state]

		if (!validTargets.includes(targetState)) {
			return {
				success: false,
				previousState: this._state,
				currentState: this._state,
				reason: `Invalid transition from '${this._state}' to '${targetState}'. Valid targets: ${validTargets.join(", ")}`,
			}
		}

		const previousState = this._state
		this._state = targetState

		// Track repair rounds
		if (targetState === "repairing") {
			this._repairRound++
		}

		// Reset repair round when entering a new planning phase
		if (targetState === "planning" && previousState === "created") {
			this._repairRound = 0
		}

		const transition = {
			from: previousState,
			to: targetState,
			timestamp: new Date().toISOString(),
			reason,
		}
		this._transitionHistory.push(transition)

		return {
			success: true,
			previousState,
			currentState: targetState,
			reason,
		}
	}

	/**
	 * Transition based on review decision
	 *
	 * This is the recommended way to handle review outcomes.
	 * It automatically determines the correct next state based on
	 * the review decision and current repair round count.
	 */
	transitionFromReview(decision: ReviewDecision): StateTransitionResult {
		if (this._state !== "reviewing") {
			return {
				success: false,
				previousState: this._state,
				currentState: this._state,
				reason: `Cannot process review decision in state '${this._state}'. Expected 'reviewing'.`,
			}
		}

		const nextState = resolveNextState(decision, this._repairRound, this._maxRepairRounds)
		return this.transition(nextState, `Review decision: ${decision}`)
	}

	/**
	 * Check if a transition is valid without performing it
	 */
	canTransition(targetState: OrchestratorSessionState): boolean {
		return VALID_TRANSITIONS[this._state].includes(targetState)
	}

	/**
	 * Get valid next states
	 */
	getValidTransitions(): OrchestratorSessionState[] {
		return [...VALID_TRANSITIONS[this._state]]
	}

	/**
	 * Reset the state machine (for testing only)
	 */
	reset(maxRepairRounds?: number): void {
		this._state = "created"
		this._repairRound = 0
		this._maxRepairRounds = maxRepairRounds ?? this._maxRepairRounds
		this._transitionHistory = []
	}
}