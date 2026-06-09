/**
 * Orchestrator Module
 *
 * Multi-model orchestration system for VSCode extension.
 *
 * Architecture:
 * - OrchestratorSession: Manages single session lifecycle
 * - OrchestratorSessionManager: Manages multiple sessions
 * - CodexPlanner: Generates structured task plans (Codex)
 * - TaskRouter: Routes tasks to appropriate models
 * - CodexReviewer: Reviews execution results (Codex)
 * - VerificationRunner: Runs verification commands
 *
 * Integration:
 * - ClineProvider creates OrchestratorSessionManager
 * - Sessions coordinate with existing Task system for execution
 * - Planner/Reviewer use SingleCompletionHandler (no full agent loop)
 */

// Protocol (re-exports from @roo-code/types)
export * from "./protocol"

// Session
export { OrchestratorSession, type OrchestratorSessionConfig, type SessionStats } from "./session/OrchestratorSession"
export {
	OrchestratorSessionManager,
	type SessionManagerConfig,
	type StartSessionOptions,
	createSessionManager,
} from "./session/OrchestratorSessionManager"
export {
	OrchestratorStateMachine,
	type StateTransitionResult,
	resolveNextState,
} from "./session/stateMachine"
export {
	evaluateRepairNeed,
	generateRepairTasksFromFindings,
	prepareRepairRound,
	type RepairLoopResult,
} from "./session/repairLoop"

// Planner
export { CodexPlanner, type CodexPlannerConfig } from "./planner/CodexPlanner"
export {
	PLANNER_SYSTEM_PROMPT,
	buildPlannerUserPrompt,
	buildRepairPlanPrompt,
} from "./planner/planner-prompts"

// Router
export {
	TaskRouter,
	type RuntimeSignals,
	type RoutingResult,
	createDefaultRouter,
} from "./router/TaskRouter"

// Context
export {
	buildContextBundle,
	buildMinimalContext,
	type ContextBundleOptions,
} from "./context/ContextBundleBuilder"

// Verifier
export {
	VerificationRunner,
	type VerificationCommand,
	type VerificationProfileConfig,
	type CommandExecutor,
	determineVerificationProfile,
	createVerificationRunner,
} from "./verifier/VerificationRunner"

// Reviewer
export {
	CodexReviewer,
	type CodexReviewerConfig,
	type ReviewReviewInput,
	createReviewer,
} from "./reviewer/CodexReviewer"
export {
	REVIEWER_SYSTEM_PROMPT,
	buildReviewerUserPrompt,
} from "./reviewer/reviewer-prompts"

// Worker
export {
	ExecTaskRunner,
	type ExecTaskRunnerConfig,
	type ExecTaskExecutionResult,
	createExecTaskRunner,
} from "./worker/ExecTaskRunner"
export {
	WORKER_SYSTEM_PROMPT,
	buildWorkerPrompt,
	buildRepairPrompt,
} from "./worker/worker-prompts"
