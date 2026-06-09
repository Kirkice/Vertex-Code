/**
 * Codex Reviewer
 *
 * Uses Codex to review execution results and make accept/repair/reject decisions.
 * Does NOT run a full agent task - only produces structured JSON output.
 *
 * Responsibilities:
 * - Review executed tasks against original objectives
 * - Evaluate verification results
 * - Generate findings with severity levels
 * - Decide accept/repair/reject/needs_user_confirmation
 * - Generate repair tasks when needed
 */

import type {
	ContextBundle,
	ReviewRequestPayload,
	ReviewResponsePayload,
	ReviewDecision,
	ReviewFinding,
	ExecTask,
	VerifyResponsePayload,
	ReviewPolicy,
} from "@roo-code/types"
import type { ProviderSettings } from "@roo-code/types"
import { buildApiHandler, type ApiHandler, type SingleCompletionHandler } from "../../api"
import { REVIEWER_SYSTEM_PROMPT, buildReviewerUserPrompt } from "./reviewer-prompts"

/**
 * Reviewer configuration
 */
export interface CodexReviewerConfig {
	providerSettings: ProviderSettings
	policy?: Partial<ReviewPolicy>
	maxAttempts?: number
}

/**
 * Default review policy
 */
const DEFAULT_POLICY: ReviewPolicy = {
	mayRequestRepair: true,
	maxRepairRounds: 2,
	requireDecision: true,
}

/**
 * Codex Reviewer
 */
export class CodexReviewer {
	private handler: ApiHandler
	private policy: ReviewPolicy
	private maxAttempts: number

	constructor(config: CodexReviewerConfig) {
		this.handler = buildApiHandler(config.providerSettings)
		this.policy = { ...DEFAULT_POLICY, ...config.policy }
		this.maxAttempts = config.maxAttempts ?? 2
	}

	/**
	 * Review execution results
	 */
	async review(request: ReviewReviewInput): Promise<ReviewResponsePayload> {
		const reviewPayload: ReviewRequestPayload = {
			type: "review.request",
			originalUserRequest: request.originalUserRequest,
			planSummary: request.planSummary,
			executedTasks: request.executedTasks,
			diff: request.diff,
			verification: request.verification,
			reviewPolicy: this.policy,
		}

		const userPrompt = buildReviewerUserPrompt(reviewPayload)
		let lastError: Error | null = null

		for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
			try {
				const response = await this.callCodex(userPrompt)
				return this.parseReviewResponse(response)
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error))
				console.warn(`[CodexReviewer] Review attempt ${attempt} failed:`, lastError.message)
			}
		}

		// Fallback: return a conservative reject if all attempts fail
		return {
			type: "review.response",
			decision: "reject",
			summary: `Review failed after ${this.maxAttempts} attempts: ${lastError?.message}`,
			findings: [
				{
					severity: "high",
					message: `Reviewer unavailable: ${lastError?.message}`,
				},
			],
		}
	}

	/**
	 * Call Codex and get response text
	 */
	private async callCodex(userPrompt: string): Promise<string> {
		if ("completePrompt" in this.handler && typeof this.handler.completePrompt === "function") {
			return (this.handler as unknown as SingleCompletionHandler).completePrompt(userPrompt)
		}

		const messages: Array<{ role: "user" | "assistant"; content: string }> = [
			{ role: "user", content: userPrompt },
		]

		const stream = this.handler.createMessage(REVIEWER_SYSTEM_PROMPT, messages)
		let responseText = ""

		for await (const chunk of stream) {
			if (chunk.type === "text") {
				responseText += chunk.text
			}
		}

		return responseText
	}

	/**
	 * Parse Codex response into ReviewResponsePayload
	 */
	private parseReviewResponse(responseText: string): ReviewResponsePayload {
		const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/)

		if (!jsonMatch) {
			throw new Error("Reviewer response does not contain valid JSON")
		}

		const jsonString = jsonMatch[1] || jsonMatch[0]
		let parsed: Record<string, unknown>

		try {
			parsed = JSON.parse(jsonString)
		} catch (e) {
			throw new Error(`Failed to parse reviewer JSON: ${e}`)
		}

		// Validate decision
		const validDecisions: ReviewDecision[] = ["accept", "repair", "reject", "needs_user_confirmation"]
		const decision = parsed.decision as ReviewDecision

		if (!validDecisions.includes(decision)) {
			throw new Error(`Invalid review decision: ${decision}. Must be one of: ${validDecisions.join(", ")}`)
		}

		return {
			type: "review.response",
			decision,
			summary: (parsed.summary as string) || "",
			findings: (parsed.findings as ReviewFinding[]) || [],
			repairTasks: parsed.repairTasks as ExecTask[] | undefined,
			userConfirmationQuestion: parsed.userConfirmationQuestion as string | undefined,
		}
	}
}

/**
 * Input for review
 */
export interface ReviewReviewInput {
	originalUserRequest: string
	planSummary: string
	executedTasks: ExecTask[]
	diff: string
	verification: VerifyResponsePayload
}

/**
 * Create a reviewer with default configuration
 */
export function createReviewer(providerSettings: ProviderSettings): CodexReviewer {
	return new CodexReviewer({ providerSettings })
}