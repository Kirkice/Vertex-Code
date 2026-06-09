/**
 * Exec Task Runner
 *
 * Creates controlled Task instances for orchestrator execution tasks.
 * Integrates with existing ClineProvider.createTask() system.
 *
 * Key design decisions:
 * - Reuses existing Task infrastructure (no reimplementation)
 * - Injects orchestration metadata via mode/provider profile switching
 * - Collects results (diff, changed files) from completed tasks
 */

import type {
	ExecTask,
	ContextBundle,
	WorkerResultPayload,
	WorkerTaskStatus,
	WorkerOutputs,
	AcceptanceCriterion,
	ProviderSettings,
	ReviewFinding,
} from "@roo-code/types"
import { TaskRouter, type RuntimeSignals, type RoutingResult } from "../router/TaskRouter"
import { buildWorkerPrompt, buildRepairPrompt, WORKER_SYSTEM_PROMPT } from "./worker-prompts"

/**
 * Exec task runner configuration
 */
export interface ExecTaskRunnerConfig {
	/** Function to create a task via ClineProvider */
	createTaskFn: (
		text: string,
		images?: string[],
		parentTask?: unknown,
		options?: {
			mode?: string
			providerProfile?: string
			initialTodos?: Array<{ id: string; content: string; status: string }>
			workspacePath?: string
		},
	) => Promise<{
		taskId: string
		waitForCompletion: () => Promise<{
			success: boolean
			diff?: string
			changedFiles: string[]
			summary: string
		}>
	}>
	/** Task router for model selection */
	router: TaskRouter
	/** Provider settings lookup function */
	getProviderSettings: (profileName: string) => ProviderSettings | undefined
	/** Default worker mode */
	workerMode?: string
	/** Default worker provider profile */
	workerProfile?: string
}

/**
 * Execution result from a worker task
 */
export interface ExecTaskExecutionResult {
	/** Task ID in the execution system */
	executionTaskId: string
	/** Whether execution succeeded */
	success: boolean
	/** Result status */
	status: WorkerTaskStatus
	/** Summary of what was done */
	summary: string
	/** Unified diff of changes */
	diff?: string
	/** List of changed files */
	changedFiles: string[]
	/** Any warnings */
	warnings: string[]
	/** Error message if failed */
	error?: string
}

/**
 * Exec Task Runner
 *
 * Orchestrates the execution of ExecTasks by:
 * 1. Routing to appropriate model via TaskRouter
 * 2. Building worker prompt with constraints
 * 3. Creating controlled Task via ClineProvider
 * 4. Collecting and formatting results
 */
export class ExecTaskRunner {
	private config: ExecTaskRunnerConfig

	constructor(config: ExecTaskRunnerConfig) {
		this.config = config
	}

	/**
	 * Execute a single exec task
	 */
	async execute(
		task: ExecTask,
		context: ContextBundle,
		runtimeSignals?: Partial<RuntimeSignals>,
	): Promise<ExecTaskExecutionResult> {
		// 1. Route to appropriate model
		const routing = this.config.router.route(task, runtimeSignals)
		console.log(
			`[ExecTaskRunner] Task ${task.taskId} routed to ${routing.selectedModel.provider}: ${routing.reason}`,
		)

		// 2. Build worker prompt
		const workerPrompt = buildWorkerPrompt(task, context)

		// 3. Determine mode and provider profile
		const mode = this.config.workerMode ?? "code"
		const profile = this.resolveProviderProfile(routing, task)

		// 4. Convert acceptance criteria to todos
		const initialTodos = task.acceptanceCriteria.map((ac) => ({
			id: ac.id,
			content: ac.description,
			status: "pending" as const,
		}))

		// 5. Create controlled task
		try {
			const execution = await this.config.createTaskFn(workerPrompt, undefined, undefined, {
				mode,
				providerProfile: profile,
				initialTodos,
				workspacePath: task.allowedWritePaths[0],
			})

			// 6. Wait for completion
			const result = await execution.waitForCompletion()

			return {
				executionTaskId: execution.taskId,
				success: result.success,
				status: result.success ? "succeeded" : "failed",
				summary: result.summary,
				diff: result.diff,
				changedFiles: result.changedFiles,
				warnings: [],
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			return {
				executionTaskId: "",
				success: false,
				status: "failed",
				summary: `Execution failed: ${errorMessage}`,
				changedFiles: [],
				warnings: [],
				error: errorMessage,
			}
		}
	}

	/**
	 * Execute a repair task
	 */
	async executeRepair(
		originalTask: ExecTask,
		findings: ReviewFinding[],
		context: ContextBundle,
		runtimeSignals?: Partial<RuntimeSignals>,
	): Promise<ExecTaskExecutionResult> {
		// Build repair prompt
		const repairPrompt = buildRepairPrompt(originalTask, findings)

		// Create repair task with same constraints as original
		const mode = this.config.workerMode ?? "code"
		const profile = this.config.workerProfile

		const initialTodos = findings
			.filter((f) => f.severity === "high" || f.severity === "medium")
			.map((f, i) => ({
				id: `repair-${i}`,
				content: `Fix: ${f.message}`,
				status: "pending" as const,
			}))

		try {
			const execution = await this.config.createTaskFn(repairPrompt, undefined, undefined, {
				mode,
				providerProfile: profile,
				initialTodos,
				workspacePath: originalTask.allowedWritePaths[0],
			})

			const result = await execution.waitForCompletion()

			return {
				executionTaskId: execution.taskId,
				success: result.success,
				status: result.success ? "succeeded" : "failed",
				summary: result.summary,
				diff: result.diff,
				changedFiles: result.changedFiles,
				warnings: [],
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			return {
				executionTaskId: "",
				success: false,
				status: "failed",
				summary: `Repair execution failed: ${errorMessage}`,
				changedFiles: [],
				warnings: [],
				error: errorMessage,
			}
		}
	}

	/**
	 * Convert execution result to WorkerResultPayload
	 */
	toWorkerResult(execTaskId: string, result: ExecTaskExecutionResult): WorkerResultPayload {
		const outputs: WorkerOutputs = {}

		if (result.diff) {
			outputs.patch = {
				format: "unified_diff",
				content: result.diff,
				changedFiles: result.changedFiles,
			}
		}

		return {
			type: "task.result",
			taskId: execTaskId,
			status: result.status,
			summary: result.summary,
			reasoningSummary: "",
			outputs,
			warnings: result.warnings,
		}
	}

	/**
	 * Resolve provider profile name from routing result
	 */
	private resolveProviderProfile(routing: RoutingResult, task: ExecTask): string | undefined {
		// If task has a specific preferred model, try to find matching profile
		if (task.preferredModel.provider !== "auto") {
			const profileName = `${task.preferredModel.provider}-profile`
			const settings = this.config.getProviderSettings(profileName)
			if (settings) {
				return profileName
			}
		}

		// Use default worker profile
		return this.config.workerProfile
	}
}

/**
 * Create an ExecTaskRunner with default configuration
 */
export function createExecTaskRunner(config: ExecTaskRunnerConfig): ExecTaskRunner {
	return new ExecTaskRunner(config)
}