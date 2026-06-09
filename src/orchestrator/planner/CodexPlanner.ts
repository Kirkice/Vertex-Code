/**
 * Codex Planner
 *
 * Uses OpenAI Codex to generate structured task plans.
 * Does NOT run a full agent task - only produces structured JSON output.
 *
 * Responsibilities:
 * - Call Codex to produce task tree
 * - Generate acceptance criteria, modification boundaries, risk warnings
 * - Enforce structured JSON output (no free-form natural language)
 */

import type {
	ContextBundle,
	PlanRequestPayload,
	PlanResponsePayload,
	ExecTask,
	PlanningPolicy,
	FinalReviewTemplate,
} from "@roo-code/types"
import { createTaskId } from "@roo-code/types"
import type { ProviderSettings } from "@roo-code/types"
import { buildApiHandler, type ApiHandler, type SingleCompletionHandler } from "../../api"
import { PLANNER_SYSTEM_PROMPT, buildPlannerUserPrompt } from "./planner-prompts"

/**
 * Planner configuration
 */
export interface CodexPlannerConfig {
	/** Provider settings for Codex (should be openai-codex) */
	providerSettings: ProviderSettings
	/** Planning policy */
	policy?: Partial<PlanningPolicy>
	/** Maximum planning attempts */
	maxAttempts?: number
}

/**
 * Default planning policy
 */
const DEFAULT_POLICY: PlanningPolicy = {
	maxDepth: 3,
	preferParallelizableTasks: true,
	requireAcceptanceCriteria: true,
	requireAllowedWritePaths: true,
}

/**
 * Codex Planner
 *
 * Generates structured task plans using Codex.
 * Uses SingleCompletionHandler pattern - no full agent loop.
 */
export class CodexPlanner {
	private handler: ApiHandler
	private policy: PlanningPolicy
	private maxAttempts: number

	constructor(config: CodexPlannerConfig) {
		this.handler = buildApiHandler(config.providerSettings)
		this.policy = { ...DEFAULT_POLICY, ...config.policy }
		this.maxAttempts = config.maxAttempts ?? 2
	}

	/**
	 * Generate a task plan from user request and context
	 */
	async plan(userRequest: string, context: ContextBundle): Promise<PlanResponsePayload> {
		const requestPayload: PlanRequestPayload = {
			type: "plan.request",
			userRequest,
			context,
			planningPolicy: this.policy,
		}

		const userPrompt = buildPlannerUserPrompt(requestPayload)

		let lastError: Error | null = null

		for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
			try {
				const response = await this.callCodex(userPrompt)
				const plan = this.parsePlanResponse(response, context.bundleId)
				return plan
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error))
				console.warn(`[CodexPlanner] Planning attempt ${attempt} failed:`, lastError.message)
			}
		}

		throw new Error(`Planning failed after ${this.maxAttempts} attempts: ${lastError?.message}`)
	}

	/**
	 * Call Codex and get response text
	 */
	private async callCodex(userPrompt: string): Promise<string> {
		// Check if handler supports SingleCompletionHandler
		if ("completePrompt" in this.handler && typeof this.handler.completePrompt === "function") {
			return (this.handler as unknown as SingleCompletionHandler).completePrompt(userPrompt)
		}

		// Fallback: use createMessage and collect stream
		const messages: Array<{ role: "user" | "assistant"; content: string }> = [
			{
				role: "user",
				content: userPrompt,
			},
		]

		const stream = this.handler.createMessage(PLANNER_SYSTEM_PROMPT, messages)
		let responseText = ""

		for await (const chunk of stream) {
			if (chunk.type === "text") {
				responseText += chunk.text
			}
		}

		return responseText
	}

	/**
	 * Parse Codex response into structured PlanResponsePayload
	 */
	private parsePlanResponse(responseText: string, contextBundleId: string): PlanResponsePayload {
		// Try to extract JSON from response
		const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/)

		if (!jsonMatch) {
			throw new Error("Planner response does not contain valid JSON")
		}

		const jsonString = jsonMatch[1] || jsonMatch[0]
		let parsed: Record<string, unknown>

		try {
			parsed = JSON.parse(jsonString)
		} catch (e) {
			throw new Error(`Failed to parse planner JSON: ${e}`)
		}

		// Validate required fields
		if (!parsed.planSummary || typeof parsed.planSummary !== "string") {
			throw new Error("Planner response missing 'planSummary'")
		}

		if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
			throw new Error("Planner response must contain at least one task")
		}

		// Transform tasks to ExecTask format
		const tasks: ExecTask[] = (parsed.tasks as Array<Record<string, unknown>>).map((t, index) =>
			this.transformToExecTask(t, contextBundleId, index),
		)

		// Build final review template
		const finalReviewTemplate: FinalReviewTemplate = parsed.finalReviewTemplate
			? (parsed.finalReviewTemplate as FinalReviewTemplate)
			: this.buildDefaultReviewTemplate(parsed.planSummary as string)

		return {
			type: "plan.response",
			planSummary: parsed.planSummary as string,
			assumptions: (parsed.assumptions as string[]) || [],
			risks: (parsed.risks as string[]) || [],
			tasks,
			finalReviewTemplate,
		}
	}

	/**
	 * Transform raw task object to ExecTask
	 */
	private transformToExecTask(
		raw: Record<string, unknown>,
		contextBundleId: string,
		index: number,
	): ExecTask {
		const now = new Date().toISOString()

		return {
			taskId: (raw.taskId as string) || createTaskId("exec"),
			sessionId: "", // Will be set by session controller
			kind: "exec",
			title: (raw.title as string) || `Task ${index + 1}`,
			objective: (raw.objective as string) || "",
			status: "pending",
			priority: ((raw.priority as number) || 3) as 1 | 2 | 3 | 4 | 5,
			dependsOn: (raw.dependsOn as Array<{ taskId: string; title: string }>) || [],
			contextBundleIds: [contextBundleId],
			inputs: (raw.inputs as Record<string, unknown>) || {},
			constraints: (raw.constraints as Array<{ type: "allowed_files" | "forbidden_files" | "max_files" | "read_only" | "no_side_effects"; value: unknown }>) || [],
			acceptanceCriteria: (raw.acceptanceCriteria as Array<{
				id: string
				description: string
				required: boolean
				verificationHint?: string
			}>) || [{ id: `ac-${index}`, description: "Task completed successfully", required: true }],
			preferredModel: (raw.preferredModel as { provider: "codex" | "deepseek" | "qwen" | "claude" | "auto"; model?: string }) || {
				provider: "auto",
			},
			retryCount: 0,
			maxRetries: 2,
			createdAt: now,
			updatedAt: now,
			// ExecTask specific fields
			allowedWritePaths: (raw.allowedWritePaths as string[]) || [],
			expectedOutputs: (raw.expectedOutputs as Array<"patch" | "analysis" | "test_plan" | "command_suggestion">) || [
				"patch",
			],
			riskLevel: (raw.riskLevel as "low" | "medium" | "high") || "medium",
		}
	}

	/**
	 * Build default review template
	 */
	private buildDefaultReviewTemplate(planSummary: string): FinalReviewTemplate {
		return {
			successDefinition: `All tasks completed according to plan: ${planSummary}`,
			mustCheckItems: [
				"All acceptance criteria met",
				"No unintended side effects",
				"Code compiles without errors",
				"Tests pass",
			],
		}
	}
}