import * as vscode from "vscode"

import { t } from "../../i18n"
import type { WebviewHandlerContext } from "./ports"
import type { ClineProvider } from "./ClineProvider"

/**
 * Task history/export/delete boundary.
 *
 * 任务历史、导出与删除消息边界；保留现有 Provider facade，降低主路由器职责。
 */
export async function handleTaskHistoryMessage(context: WebviewHandlerContext): Promise<boolean> {
	const { message } = context
	const provider = context.provider as ClineProvider

	switch (message.type) {
		case "clearTask":
			await provider.clearTask()
			await context.postWebviewState()
			return true
		case "exportCurrentTask": {
			const taskId = provider.getCurrentTask()?.taskId
			if (taskId) await provider.exportTaskWithId(taskId)
			return true
		}
		case "shareCurrentTask":
			if (!provider.getCurrentTask()?.taskId) {
				vscode.window.showErrorMessage(t("common:errors.share_no_active_task"))
			} else {
				vscode.window.showErrorMessage(t("common:errors.share_not_enabled"))
			}
			return true
		case "showTaskWithId":
			await provider.showTaskWithId(message.text!)
			return true
		case "condenseTaskContextRequest":
			await provider.condenseTaskContext(message.text!)
			return true
		case "deleteTaskWithId":
			try {
				await provider.deleteTaskWithId(message.text!)
			} catch (error) {
				provider.log(`Failed to delete task ${message.text}: ${String(error)}`)
				vscode.window.showErrorMessage(`Failed to delete task: ${String(error)}`)
				await context.postWebviewState()
			}
			return true
		case "deleteMultipleTasksWithIds": {
			const ids = message.ids
			if (!Array.isArray(ids)) return true
			for (let i = 0; i < ids.length; i += 20) {
				await Promise.all(
					ids.slice(i, i + 20).map(async (id) => {
						try {
							await provider.deleteTaskWithId(id)
						} catch (error) {
							provider.log(`Failed to delete task ${id}: ${String(error)}`)
						}
					}),
				)
				await context.postWebviewState()
			}
			return true
		}
		case "exportTaskWithId":
			await provider.exportTaskWithId(message.text!)
			return true
		case "getTaskWithAggregatedCosts": {
			try {
				const taskId = message.text
				if (!taskId) throw new Error("Task ID is required")
				const result = await provider.getTaskWithAggregatedCosts(taskId)
				await context.postWebviewMessage({ type: "taskWithAggregatedCosts", text: taskId, ...result })
			} catch (error) {
				await context.postWebviewMessage({
					type: "taskWithAggregatedCosts",
					text: message.text,
					error: String(error),
				})
			}
			return true
		}
		default:
			return false
	}
}
