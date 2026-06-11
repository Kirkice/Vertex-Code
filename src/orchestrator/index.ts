/**
 * Orchestrator Module
 *
 * Multi-model orchestration system for VSCode extension.
 * The orchestrator is now integrated as a workflow mode within Task
 * (see src/core/task/OrchestratorEngine.ts). This module provides the
 * reusable components (Planner, Reviewer, Worker, Router, Context, Verifier).
 *
 * Architecture:
 * - OrchestratorEngine: Drives the Plan → Approve → Execute → Review → Repair loop inside Task
 * - CodexPlanner: Generates structured task plans (Codex)
 * - TaskRouter: Routes tasks to appropriate models
 * - CodexReviewer: Reviews execution results (Codex)
 * - VerificationRunner: Runs verification commands
 *
 * Integration:
 * - Task creates OrchestratorEngine when orchestratorMode is enabled
 * - Planner/Reviewer use SingleCompletionHandler (no full agent loop)
 */

// Protocol (re-exports from @roo-code/types)
export * from "./protocol"

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
