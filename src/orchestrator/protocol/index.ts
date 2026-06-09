/**
 * Orchestrator Protocol
 *
 * Re-exports all orchestrator types from @roo-code/types for convenience.
 * All type definitions live in packages/types/src/orchestrator.ts and
 * packages/types/src/orchestrator-events.ts to maintain single source of truth.
 */

// Core types
export type {
	OrchestratorTaskStatus,
	OrchestratorTaskKind,
	TaskRef,
	AcceptanceCriterion,
	TaskConstraintType,
	TaskConstraint,
	ModelPreference,
	OrchestratorTask,
	ExecTaskOutputType,
	RiskLevel,
	ExecTask,
	ReviewInputs,
	ReviewTask,
	ContextFileReason,
	ContextFile,
	SymbolRef,
	ContextBundle,
	VerificationProfile,
	VerificationStatus,
	CommandResult,
	VerificationReport,
	OrchestratorSessionState,
	ReviewDecision,
	FindingSeverity,
	ReviewFinding,
} from "@roo-code/types"

// Type guards
export { isExecTask, isReviewTask, createTaskId, createBundleId, createReportId } from "@roo-code/types"

// Event types
export type {
	OrchestratorComponent,
	MessageEnvelope,
	UserOrchestratorSettings,
	StartSessionPayload,
	ApprovePlanPayload,
	CancelSessionPayload,
	RetryTaskPayload,
	UiToExtensionMessage,
	PlanningPolicy,
	PlanRequestPayload,
	FinalReviewTemplate,
	PlanResponsePayload,
	ExecutionPolicy,
	ExecuteTaskPayload,
	PatchOutput,
	WorkerOutputs,
	WorkerTaskStatus,
	WorkerResultPayload,
	VerifyRequestPayload,
	VerifyCommandResult,
	VerifyResponsePayload,
	ReviewPolicy,
	ReviewRequestPayload,
	ReviewResponsePayload,
	SessionStateChangeEvent,
	TaskStateChangeEvent,
	TaskCreatedEvent,
	TaskCompletedEvent,
	ModelSelectedEvent,
	RepairLoopEvent,
	OrchestratorEvent,
	OrchestratorStatePush,
	OrchestratorTaskUpdate,
	OrchestratorReviewResult,
	OrchestratorCostUpdate,
	OrchestratorWebviewPush,
} from "@roo-code/types"

// Event helpers
export { createMessageId, createTraceId, createEnvelope } from "@roo-code/types"