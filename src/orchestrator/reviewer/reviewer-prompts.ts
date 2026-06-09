/**
 * Reviewer Prompts
 *
 * Prompt templates for Codex Reviewer.
 * Enforces structured JSON output with explicit decision.
 */

import type { ReviewRequestPayload } from "@roo-code/types"

/**
 * System prompt for Reviewer
 */
export const REVIEWER_SYSTEM_PROMPT = `You are a Code Reviewer for a VSCode extension's multi-model orchestration system.

Your role is to review execution results and make clear decisions. You do NOT execute tasks - you only review them.

## Output Requirements

You MUST output a valid JSON object with the following structure:

\`\`\`json
{
  "decision": "accept|repair|reject|needs_user_confirmation",
  "summary": "Brief explanation of the decision",
  "findings": [
    {
      "severity": "high|medium|low",
      "file": "optional file path",
      "message": "Description of the finding"
    }
  ],
  "repairTasks": [],
  "userConfirmationQuestion": null
}
\`\`\`

## Decision Guidelines

### accept
- All acceptance criteria are met
- Verification passed (or partial with only non-critical issues)
- Code changes align with original request
- No high-severity findings

### repair
- Some acceptance criteria not met
- Verification failed on critical checks
- Code changes partially implement the request
- Issues are fixable within the same scope

When decision is "repair", you MUST provide \`repairTasks\` array with specific repair tasks.

### reject
- Implementation fundamentally misunderstands the request
- Changes introduce breaking issues that cannot be easily fixed
- Changes modify files outside allowed scope
- Multiple high-severity findings indicate systemic problems

### needs_user_confirmation
- Implementation is technically correct but makes significant design decisions
- Changes affect public APIs or user-facing behavior
- Ambiguity in original request led to multiple valid interpretations

When decision is "needs_user_confirmation", you MUST provide \`userConfirmationQuestion\`.

## Rules

1. **Be specific**: Reference exact files, line numbers, and code when possible.

2. **Severity levels**:
   - \`high\`: Breaking issues, security concerns, data loss risks
   - \`medium\`: Logic errors, missing edge cases, poor performance
   - \`low\*: Style issues, minor optimizations, documentation gaps

3. **No soft conclusions**: Never say "looks good" or "probably fine". Give explicit accept/repair/reject/needs_user_confirmation.

4. **Repair tasks must be actionable**: Include specific objectives, allowed files, and acceptance criteria.

5. **Respect boundaries**: Do not suggest changes outside the original task scope.
`

/**
 * Build user prompt for reviewer
 */
export function buildReviewerUserPrompt(request: ReviewRequestPayload): string {
	const parts: string[] = []

	// Original request
	parts.push(`## Original User Request\n\n${request.originalUserRequest}`)

	// Plan summary
	parts.push(`## Plan Summary\n\n${request.planSummary}`)

	// Executed tasks
	parts.push(`## Executed Tasks\n`)
	for (const task of request.executedTasks) {
		const status = task.status === "succeeded" ? "✓" : "✗"
		parts.push(`### ${status} ${task.title} (${task.taskId})`)
		parts.push(`**Objective**: ${task.objective}`)
		parts.push(`**Status**: ${task.status}`)
		if (task.acceptanceCriteria.length > 0) {
			parts.push(`**Acceptance Criteria**:`)
			for (const ac of task.acceptanceCriteria) {
				parts.push(`- [${ac.required ? "required" : "optional"}] ${ac.description}`)
			}
		}
		parts.push("")
	}

	// Diff
	if (request.diff) {
		parts.push(`## Code Changes (unified diff)\n\n\`\`\`diff\n${request.diff}\n\`\`\``)
	}

	// Verification results
	parts.push(`## Verification Results\n`)
	parts.push(`**Overall Status**: ${request.verification.overallStatus}`)
	parts.push(`**Summary**: ${request.verification.summary}`)

	if (request.verification.commandResults.length > 0) {
		parts.push(`\n### Command Results\n`)
		for (const result of request.verification.commandResults) {
			const icon = result.exitCode === 0 ? "✓" : "✗"
			parts.push(`#### ${icon} ${result.command}`)
			parts.push(`- Exit code: ${result.exitCode}`)
			if (result.stdout) {
				parts.push(`- stdout: ${result.stdout.slice(0, 500)}${result.stdout.length > 500 ? "..." : ""}`)
			}
			if (result.stderr) {
				parts.push(`- stderr: ${result.stderr.slice(0, 500)}${result.stderr.length > 500 ? "..." : ""}`)
			}
			parts.push("")
		}
	}

	// Review policy
	parts.push(`## Review Policy

- May request repair: ${request.reviewPolicy.mayRequestRepair}
- Max repair rounds: ${request.reviewPolicy.maxRepairRounds}
- Require decision: ${request.reviewPolicy.requireDecision}
`)

	parts.push(`## Output

Generate your review as a JSON object following the schema in the system prompt. Output ONLY the JSON, wrapped in \`\`\`json code blocks.`)

	return parts.join("\n\n")
}