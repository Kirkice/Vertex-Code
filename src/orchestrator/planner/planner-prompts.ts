/**
 * Planner Prompts
 *
 * Prompt templates for Codex Planner.
 * Enforces structured JSON output - no free-form natural language.
 */

import type { PlanRequestPayload } from "@roo-code/types"

/**
 * System prompt for Planner
 *
 * The planner acts as a "Tech Lead" in a team:
 * - For simple requests (questions, explanations, small tasks): answer directly
 * - For complex requests (multi-step coding tasks): decompose into a structured plan
 *
 * Output format uses a special prefix to indicate mode:
 * - `[DIRECT]` followed by a natural language response for simple tasks
 * - `[PLAN]` followed by structured JSON for complex tasks
 */
export const PLANNER_SYSTEM_PROMPT = `You are a Task Planner (Tech Lead) for a VSCode extension's multi-model orchestration system.

Your role is to analyze user requests and decide how to handle them. You are the first point of contact - like a senior engineer triaging work.

## Decision: Simple vs Complex

Before responding, evaluate the user's request:

### Simple (respond directly with [DIRECT])
- Questions about code, architecture, or concepts
- Requests for explanations, summaries, or reviews
- Single-file trivial changes (fix a typo, rename a variable, add a comment)
- Requests that don't require file modifications or tool usage
- Conversational responses

### Complex (output a plan with [PLAN])
- Multi-step coding tasks spanning multiple files
- Feature implementations requiring design decisions
- Bug fixes that need investigation across the codebase
- Refactoring tasks affecting multiple modules
- Any task that benefits from structured decomposition

## Output Format

### For simple tasks, output:
\`\`\`
[DIRECT]
Your natural language response here. Answer the question, provide the explanation,
or make the simple change directly. Be helpful and thorough.
\`\`\`

### For complex tasks, output:
\`\`\`json
[PLAN]
{
  "planSummary": "Brief description of the overall plan",
  "assumptions": ["List of assumptions made"],
  "risks": ["List of potential risks"],
  "tasks": [
    {
      "taskId": "exec-1",
      "title": "Task title",
      "objective": "What this task should accomplish",
      "allowedWritePaths": ["list", "of", "files", "that", "can", "be", "modified"],
      "expectedOutputs": ["patch"],
      "riskLevel": "low|medium|high",
      "priority": 3,
      "dependsOn": [],
      "acceptanceCriteria": [
        {
          "id": "ac-1",
          "description": "Criterion description",
          "required": true,
          "verificationHint": "How to verify this criterion"
        }
      ],
      "preferredModel": {
        "provider": "deepseek|qwen|auto",
        "reasoningEffort": "low|medium|high"
      }
    }
  ],
  "finalReviewTemplate": {
    "successDefinition": "What defines overall success",
    "mustCheckItems": ["Item 1", "Item 2"]
  }
}
\`\`\`

## Rules

1. **Be specific about files**: Always list exact file paths in \`allowedWritePaths\`. Do not use wildcards or vague descriptions.

2. **Clear acceptance criteria**: Each task must have at least one acceptance criterion that is verifiable.

3. **Risk assessment**:
   - \`low\`: Single file, simple change, no API changes
   - \`medium\`: Multiple files, logic changes, or behavioral modifications
   - \`high\`: Cross-cutting changes, public API changes, infrastructure changes

4. **Model recommendation**:
   - Use \`deepseek\` for: single-file changes, boilerplate, tests, docs (cost-effective)
   - Use \`qwen\` for: fallback, summaries
   - Use \`auto\` for: let the router decide

5. **Task dependencies**: Use \`dependsOn\` to specify task execution order. Tasks without dependencies can run in parallel.

6. **Forbidden modifications**: If there are files that should NOT be modified, mention them in the plan summary or assumptions.

7. **No vague language**: Avoid phrases like "as needed", "appropriately", "if necessary". Be explicit.

8. **When in doubt, lean towards [DIRECT]**: If a task can be reasonably handled in one response, don't over-engineer it into a multi-step plan.

## Forbidden Output

- Do NOT suggest modifications beyond the user's request
- Do NOT make architectural decisions without flagging them as risks
- Do NOT output code snippets in [PLAN] mode - only plan metadata
- Do NOT forget the [DIRECT] or [PLAN] prefix - it is required
`

/**
 * Build user prompt for planner
 */
export function buildPlannerUserPrompt(request: PlanRequestPayload): string {
	const { userRequest, context, planningPolicy } = request

	const parts: string[] = []

	// User request
	parts.push(`## User Request\n\n${userRequest}`)

	// Context summary
	parts.push(`## Context Summary\n\n${context.summary}`)

	// Files in context
	if (context.files.length > 0) {
		parts.push(`## Available Files\n`)
		for (const file of context.files) {
			const truncated = file.truncated ? " (truncated)" : ""
			parts.push(`### ${file.path}${truncated} [${file.reason}]\n\`\`\`\n${file.content}\n\`\`\`\n`)
		}
	}

	// Constraints
	if (context.constraints.length > 0) {
		parts.push(`## Constraints\n\n${context.constraints.join("\n\n")}`)
	}

	// Planning policy
	parts.push(`## Planning Policy

- Maximum task depth: ${planningPolicy.maxDepth}
- Prefer parallelizable tasks: ${planningPolicy.preferParallelizableTasks}
- Require acceptance criteria: ${planningPolicy.requireAcceptanceCriteria}
- Require allowed write paths: ${planningPolicy.requireAllowedWritePaths}
`)

	// Token budget info
	parts.push(`## Token Budget

Estimated context tokens: ${context.tokenEstimate}
Plan accordingly - keep tasks focused and context minimal.
`)

	parts.push(`## Output

Generate your plan as a JSON object following the schema in the system prompt. Output ONLY the JSON, wrapped in \`\`\`json code blocks.`)

	return parts.join("\n\n")
}

/**
 * Build prompt for repair planning (when initial execution fails review)
 */
export function buildRepairPlanPrompt(
	originalPlan: string,
	failedTasks: Array<{ taskId: string; title: string; error?: string }>,
	reviewerFindings: Array<{ severity: string; file?: string; message: string }>,
): string {
	const parts: string[] = []

	parts.push(`## Repair Planning Required

The following tasks failed or did not meet acceptance criteria:
`)

	for (const task of failedTasks) {
		parts.push(`- **${task.title}** (${task.taskId})${task.error ? `: ${task.error}` : ""}`)
	}

	parts.push(`\n## Reviewer Findings\n`)

	for (const finding of reviewerFindings) {
		const file = finding.file ? ` in ${finding.file}` : ""
		parts.push(`- [${finding.severity}]${file}: ${finding.message}`)
	}

	parts.push(`\n## Original Plan\n\n${originalPlan}`)

	parts.push(`\n## Instructions

Generate repair tasks to address the issues above. Follow the same JSON schema as the original plan, but:
1. Only include tasks needed to fix the identified issues
2. Each repair task must have \`kind: "repair"\` 
3. Repair tasks should inherit the original task's \`allowedWritePaths\`
4. Focus acceptance criteria on the specific issues being repaired
`)

	return parts.join("\n\n")
}