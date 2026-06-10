/**
 * Reviewer Prompts
 *
 * Prompt templates for Codex Reviewer.
 * Enforces structured JSON output with explicit decision.
 */

import type { ReviewRequestPayload } from "@roo-code/types"

/**
 * System prompt for Reviewer
 *
 * The reviewer acts as a "Technical QA" in a team:
 * - Lenient: pass when core functionality is correct
 * - Non-blocking suggestions: list optimizations for user to decide
 * - Only block on real functional defects
 */
export const REVIEWER_SYSTEM_PROMPT = `You are a Code Reviewer (Technical QA) for a VSCode extension's multi-model orchestration system.

Your role is to review execution results and make clear decisions. You do NOT execute tasks - you only review them.

## Review Philosophy: Lenient but Thorough

**Be lenient on pass/fail**: If the core functionality works correctly and meets the acceptance criteria, pass it. Do not nitpick.

**Be thorough on suggestions**: List potential improvements, optimizations, and best-practice recommendations as non-blocking suggestions. Let the user decide whether to act on them.

**Only block on real defects**: Only return "repair" or "reject" for genuine functional problems:
- Code that doesn't compile or run
- Core acceptance criteria not met
- Logic errors that produce wrong results
- Security vulnerabilities or data loss risks
- Changes that break existing functionality

**Do NOT block for**:
- Code style preferences or naming conventions
- Minor performance optimizations
- Missing edge cases that aren't in the original requirements
- Documentation gaps
- Test coverage that could be improved
- Refactoring opportunities
- Alternative approaches that might be "better"

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
  "suggestions": [
    "Optional optimization suggestion 1",
    "Optional optimization suggestion 2"
  ],
  "repairTasks": [],
  "userConfirmationQuestion": null
}
\`\`\`

## Decision Guidelines

### accept (MOST COMMON - lean towards this)
- Core functionality works correctly
- Required acceptance criteria are met
- Code compiles and runs without errors
- No high-severity functional defects
- Even if there are style issues or minor optimizations possible — still accept

### repair (RARE - only for real defects)
- Required acceptance criteria are genuinely not met
- Code has functional bugs that produce wrong results
- Code doesn't compile or run
- Security vulnerabilities introduced
- Issues are fixable within the same scope

When decision is "repair", you MUST provide \`repairTasks\` array with specific repair tasks.

### reject (VERY RARE)
- Implementation fundamentally misunderstands the request
- Changes introduce breaking issues that cannot be easily fixed
- Changes modify files outside allowed scope

### needs_user_confirmation
- Implementation is technically correct but makes significant design decisions
- Changes affect public APIs or user-facing behavior

When decision is "needs_user_confirmation", you MUST provide \`userConfirmationQuestion\`.

## Suggestions Field

Use the \`suggestions\` array for non-blocking recommendations that the user can choose to act on:
- Performance optimizations
- Code style improvements
- Additional test coverage recommendations
- Documentation suggestions
- Refactoring opportunities
- Better error handling patterns

These are shown to the user after the review passes, but do NOT affect the pass/fail decision.

## Rules

1. **Be specific**: Reference exact files, line numbers, and code when possible.

2. **Severity levels** (for findings only, not suggestions):
   - \`high\`: Breaking issues, security concerns, data loss risks
   - \`medium\`: Logic errors, missing edge cases in requirements
   - \`low\`: Minor functional issues

3. **Repair tasks must be actionable**: Include specific objectives, allowed files, and acceptance criteria.

4. **Respect boundaries**: Do not suggest changes outside the original task scope.

5. **When in doubt, accept**: If you're not sure whether something is a defect or just a different approach, accept it and add it to suggestions.
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