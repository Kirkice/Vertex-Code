/**
 * Worker Prompts
 *
 * Prompt templates for worker execution tasks.
 * Enforces constraints and acceptance criteria from the orchestrator.
 */

import type { ExecTask, ContextBundle } from "@roo-code/types"

/**
 * Worker system prompt
 *
 * Key constraints:
 * - Only modify allowed files
 * - Output structured results (unified diff)
 * - Respect acceptance criteria
 * - Return blocked status if insufficient info
 */
export const WORKER_SYSTEM_PROMPT = `You are a Task Executor for a VSCode extension's multi-model orchestration system.

Your role is to execute specific coding tasks within strict boundaries.

## Rules

1. **File boundaries**: ONLY modify files explicitly listed in "Allowed files to modify". Do NOT touch any other files.

2. **Output format**: When making code changes, output them as unified diff format:
\`\`\`diff
--- a/path/to/file.ts
+++ b/path/to/file.ts
@@ -10,6 +10,7 @@ existing code
 unchanged line
-removed line
+added line
 unchanged line
\`\`\`

3. **Acceptance criteria**: Focus on meeting all REQUIRED acceptance criteria. OPTIONAL criteria are nice-to-have.

4. **No scope creep**: Do NOT make changes beyond what the objective asks for. If you notice related issues, mention them in your summary but do NOT fix them.

5. **Blocked status**: If you cannot complete the task due to:
   - Missing context or dependencies
   - Ambiguous requirements
   - Conflicts with existing code
   Return status: "blocked" with a clear explanation.

6. **Tool usage**: Use available tools (read_file, write_to_file, search_files, etc.) to complete the task efficiently.

## Output Structure

When you complete the task, provide:
1. **Summary**: Brief description of what was done
2. **Changed files**: List of files that were modified
3. **Warnings**: Any concerns or potential issues (optional)
`

/**
 * Build worker user prompt from exec task and context
 */
export function buildWorkerPrompt(task: ExecTask, context: ContextBundle): string {
	const parts: string[] = []

	// Task objective
	parts.push(`## Task Objective\n\n${task.objective}`)

	// Constraints
	parts.push(`## Constraints`)
	parts.push(`### Allowed files to modify`)
	if (task.allowedWritePaths.length > 0) {
		for (const file of task.allowedWritePaths) {
			parts.push(`- \`${file}\``)
		}
	} else {
		parts.push(`- No specific files restricted (use judgment based on objective)`)
	}

	parts.push(`\n### Expected outputs`)
	for (const output of task.expectedOutputs) {
		parts.push(`- ${formatOutputType(output)}`)
	}

	parts.push(`\n### Risk level: \`${task.riskLevel}\``)
	if (task.riskLevel === "high") {
		parts.push(`⚠️ High risk task - be extra careful with changes and ensure backward compatibility.`)
	}

	// Acceptance criteria
	parts.push(`## Acceptance Criteria\n`)
	for (const ac of task.acceptanceCriteria) {
		const badge = ac.required ? "🔴 REQUIRED" : "🟡 OPTIONAL"
		parts.push(`- [${badge}] ${ac.description}`)
		if (ac.verificationHint) {
			parts.push(`  - Verification: ${ac.verificationHint}`)
		}
	}

	// Context
	if (context.files.length > 0) {
		parts.push(`## Relevant Files\n`)
		for (const file of context.files) {
			const truncated = file.truncated ? " (truncated)" : ""
			parts.push(`### ${file.path}${truncated}`)
			parts.push(`\`\`\`\n${file.content}\n\`\`\``)
			parts.push(``)
		}
	}

	// Additional constraints
	if (context.constraints.length > 0) {
		parts.push(`## Additional Constraints\n`)
		for (const constraint of context.constraints) {
			parts.push(constraint)
			parts.push(``)
		}
	}

	// Instructions
	parts.push(`## Instructions

1. Read and understand the objective thoroughly
2. Review the relevant files before making changes
3. Only modify files in the "Allowed files to modify" list
4. Ensure all REQUIRED acceptance criteria are met
5. Output code changes in unified diff format
6. If you encounter issues or need clarification, return status: "blocked" with explanation
`)

	return parts.join("\n\n")
}

/**
 * Build repair prompt from original task and reviewer findings
 */
export function buildRepairPrompt(
	originalTask: ExecTask,
	findings: Array<{ severity: string; file?: string; message: string }>,
): string {
	const parts: string[] = []

	parts.push(`## Repair Required\n`)
	parts.push(`The previous execution did not meet acceptance criteria. Please fix the following issues:\n`)

	for (const finding of findings) {
		const icon = finding.severity === "high" ? "🔴" : finding.severity === "medium" ? "🟡" : "🔵"
		const file = finding.file ? ` in \`${finding.file}\`` : ""
		parts.push(`- ${icon} [${finding.severity}]${file}: ${finding.message}`)
	}

	parts.push(`\n## Original Objective\n\n${originalTask.objective}`)

	parts.push(`\n## Constraints (same as original)`)
	parts.push(`### Allowed files to modify`)
	for (const file of originalTask.allowedWritePaths) {
		parts.push(`- \`${file}\``)
	}

	parts.push(`\n## Instructions

1. Focus ONLY on fixing the issues listed above
2. Do NOT make other changes beyond the identified issues
3. Maintain the same file boundaries as the original task
4. Ensure the fixes do not break existing functionality
`)

	return parts.join("\n\n")
}

/**
 * Format output type for display
 */
function formatOutputType(type: string): string {
	switch (type) {
		case "patch":
			return "Code changes (unified diff format)"
		case "analysis":
			return "Code analysis or review"
		case "test_plan":
			return "Test plan or test cases"
		case "command_suggestion":
			return "Suggested commands to run"
		default:
			return type
	}
}