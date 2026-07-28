import { customToolRegistry } from "@roo-code/core"
import { type ToolName } from "@roo-code/types"

import { t } from "../../../i18n"
import { defaultModeSlug } from "../../../shared/modes"
import type { ToolResponse, ToolUse } from "../../../shared/tools"
import { sanitizeToolUseId } from "../../../utils/tool-id"
import { formatResponse } from "../../prompts/responses"
import type { Task } from "../Task"
import type { ToolCallbacks } from "../../tools/BaseTool"

import { applyDiffTool as applyDiffToolClass } from "../../tools/ApplyDiffTool"
import { applyPatchTool } from "../../tools/ApplyPatchTool"
import { attemptCompletionTool, type AttemptCompletionCallbacks } from "../../tools/AttemptCompletionTool"
import { askFollowupQuestionTool } from "../../tools/AskFollowupQuestionTool"
import { codebaseSearchTool } from "../../tools/CodebaseSearchTool"
import { editFileTool } from "../../tools/EditFileTool"
import { editTool } from "../../tools/EditTool"
import { executeCommandTool } from "../../tools/ExecuteCommandTool"
import { generateImageTool } from "../../tools/GenerateImageTool"
import { listFilesTool } from "../../tools/ListFilesTool"
import { newTaskTool } from "../../tools/NewTaskTool"
import { readCommandOutputTool } from "../../tools/ReadCommandOutputTool"
import { readFileTool } from "../../tools/ReadFileTool"
import { runSlashCommandTool } from "../../tools/RunSlashCommandTool"
import { searchFilesTool } from "../../tools/SearchFilesTool"
import { searchReplaceTool } from "../../tools/SearchReplaceTool"
import { skillTool } from "../../tools/SkillTool"
import { switchModeTool } from "../../tools/SwitchModeTool"
import { updateTodoListTool } from "../../tools/UpdateTodoListTool"
import { useMcpToolTool } from "../../tools/UseMcpToolTool"
import { accessMcpResourceTool } from "../../tools/accessMcpResourceTool"
import { writeToFileTool } from "../../tools/WriteToFileTool"

export interface NativeToolExecutionRequest {
	task: Task
	block: ToolUse
	callbacks: ToolCallbacks
	stateExperiments?: Record<string, boolean>
	mode?: string
	askFinishSubTaskApproval: () => Promise<boolean>
	toolDescription: () => string
	checkpointSaveAndMark: () => Promise<void>
}

/**
 * Executes one complete native tool call outside the assistant stream loop.
 * 将单个 Native Tool 调用移出 assistant stream 主循环，作为稳定 Runtime 端口实现。
 */
export async function executeNativeTool(request: NativeToolExecutionRequest): Promise<void> {
	const {
		task,
		block,
		callbacks,
		stateExperiments,
		mode,
		askFinishSubTaskApproval,
		toolDescription,
		checkpointSaveAndMark,
	} = request
	const { askApproval, handleError, pushToolResult } = callbacks

	switch (block.name) {
		case "write_to_file":
			await checkpointSaveAndMark()
			await writeToFileTool.handle(task, block as ToolUse<"write_to_file">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "update_todo_list":
			await updateTodoListTool.handle(task, block as ToolUse<"update_todo_list">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "apply_diff":
			await checkpointSaveAndMark()
			await applyDiffToolClass.handle(task, block as ToolUse<"apply_diff">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "edit":
		case "search_and_replace":
			await checkpointSaveAndMark()
			await editTool.handle(task, block as ToolUse<"edit">, { askApproval, handleError, pushToolResult })
			break
		case "search_replace":
			await checkpointSaveAndMark()
			await searchReplaceTool.handle(task, block as ToolUse<"search_replace">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "edit_file":
			await checkpointSaveAndMark()
			await editFileTool.handle(task, block as ToolUse<"edit_file">, { askApproval, handleError, pushToolResult })
			break
		case "apply_patch":
			await checkpointSaveAndMark()
			await applyPatchTool.handle(task, block as ToolUse<"apply_patch">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "read_file":
			await readFileTool.handle(task, block as ToolUse<"read_file">, { askApproval, handleError, pushToolResult })
			break
		case "list_files":
			await listFilesTool.handle(task, block as ToolUse<"list_files">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "codebase_search":
			await codebaseSearchTool.handle(task, block as ToolUse<"codebase_search">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "search_files":
			await searchFilesTool.handle(task, block as ToolUse<"search_files">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "execute_command":
			await executeCommandTool.handle(task, block as ToolUse<"execute_command">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "read_command_output":
			await readCommandOutputTool.handle(task, block as ToolUse<"read_command_output">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "use_mcp_tool":
			await useMcpToolTool.handle(task, block as ToolUse<"use_mcp_tool">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "access_mcp_resource":
			await accessMcpResourceTool.handle(task, block as ToolUse<"access_mcp_resource">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "ask_followup_question":
			await askFollowupQuestionTool.handle(task, block as ToolUse<"ask_followup_question">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "switch_mode":
			await switchModeTool.handle(task, block as ToolUse<"switch_mode">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "new_task":
			await checkpointSaveAndMark()
			await newTaskTool.handle(task, block as ToolUse<"new_task">, {
				askApproval,
				handleError,
				pushToolResult,
				toolCallId: block.id,
			})
			break
		case "attempt_completion": {
			const completionCallbacks: AttemptCompletionCallbacks = {
				askApproval,
				handleError,
				pushToolResult,
				askFinishSubTaskApproval,
				toolDescription,
			}
			await attemptCompletionTool.handle(task, block as ToolUse<"attempt_completion">, completionCallbacks)
			break
		}
		case "run_slash_command":
			await runSlashCommandTool.handle(task, block as ToolUse<"run_slash_command">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		case "skill":
			await skillTool.handle(task, block as ToolUse<"skill">, { askApproval, handleError, pushToolResult })
			break
		case "generate_image":
			await checkpointSaveAndMark()
			await generateImageTool.handle(task, block as ToolUse<"generate_image">, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		default: {
			if (block.partial) {
				break
			}

			const customTool = stateExperiments?.customTools ? customToolRegistry.get(block.name) : undefined
			if (customTool) {
				try {
					let customToolArgs
					if (customTool.parameters) {
						try {
							customToolArgs = customTool.parameters.parse(block.nativeArgs || block.params || {})
						} catch (parseParamsError) {
							const message = `Custom tool "${block.name}" argument validation failed: ${
								parseParamsError instanceof Error ? parseParamsError.message : String(parseParamsError)
							}`
							console.error(message)
							task.consecutiveMistakeCount++
							await task.say("error", message)
							pushToolResult(formatResponse.toolError(message))
							break
						}
					}

					const result = await customTool.execute(customToolArgs, {
						mode: mode ?? defaultModeSlug,
						task,
					})
					console.log(
						`${customTool.name}.execute(): ${JSON.stringify(customToolArgs)} -> ${JSON.stringify(result)}`,
					)
					pushToolResult(result as ToolResponse)
					task.consecutiveMistakeCount = 0
				} catch (executionError) {
					const error = executionError instanceof Error ? executionError : new Error(String(executionError))
					task.consecutiveMistakeCount++
					task.recordToolError("custom_tool", error.message)
					await handleError(`executing custom tool "${block.name}"`, error)
				}
				break
			}

			const errorMessage = `Unknown tool "${block.name}". This tool does not exist. Please use one of the available tools.`
			task.consecutiveMistakeCount++
			task.recordToolError(block.name as ToolName, errorMessage)
			await task.say("error", t("tools:unknownToolError", { toolName: block.name }))
			task.pushToolResultToUserContent({
				type: "tool_result",
				tool_use_id: sanitizeToolUseId(block.id ?? "unknown-tool-call"),
				content: formatResponse.toolError(errorMessage),
				is_error: true,
			})
			break
		}
	}
}
