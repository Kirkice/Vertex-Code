import { describe, expect, it, vi } from "vitest"

import { handleTaskHistoryMessage } from "../taskHistoryMessageHandler"

const createContext = (message: unknown) => ({
	message,
	provider: {
		getCurrentTask: vi.fn((): { taskId: string } | undefined => ({ taskId: "active" })),
		clearTask: vi.fn(),
		exportTaskWithId: vi.fn(),
		showTaskWithId: vi.fn(),
		condenseTaskContext: vi.fn(),
		deleteTaskWithId: vi.fn(),
		getTaskWithAggregatedCosts: vi.fn(async () => ({ totalCost: 1 })),
		log: vi.fn(),
	},
	postWebviewState: vi.fn(),
	postWebviewMessage: vi.fn(),
})

describe("handleTaskHistoryMessage", () => {
	it("clears the active task and refreshes state", async () => {
		const context = createContext({ type: "clearTask" })
		await handleTaskHistoryMessage(context as never)
		expect(context.provider.clearTask).toHaveBeenCalledOnce()
		expect(context.postWebviewState).toHaveBeenCalledOnce()
	})

	it("deletes large selections in batches and refreshes after each batch", async () => {
		const ids = Array.from({ length: 21 }, (_, index) => `task-${index}`)
		const context = createContext({ type: "deleteMultipleTasksWithIds", ids })
		await handleTaskHistoryMessage(context as never)
		expect(context.provider.deleteTaskWithId).toHaveBeenCalledTimes(21)
		expect(context.postWebviewState).toHaveBeenCalledTimes(2)
	})

	it("returns aggregated costs and handles missing task IDs", async () => {
		const context = createContext({ type: "getTaskWithAggregatedCosts", text: "task-1" })
		await handleTaskHistoryMessage(context as never)
		expect(context.postWebviewMessage).toHaveBeenCalledWith({
			type: "taskWithAggregatedCosts",
			text: "task-1",
			totalCost: 1,
		})

		const missing = createContext({ type: "getTaskWithAggregatedCosts" })
		await handleTaskHistoryMessage(missing as never)
		expect(missing.postWebviewMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: "taskWithAggregatedCosts", error: "Error: Task ID is required" }),
		)
	})

	it("continues batch deletion when one task fails", async () => {
		const context = createContext({
			type: "deleteMultipleTasksWithIds",
			ids: ["task-1", "task-2"],
		})
		context.provider.deleteTaskWithId.mockRejectedValueOnce(new Error("delete failure"))

		await handleTaskHistoryMessage(context as never)

		expect(context.provider.deleteTaskWithId).toHaveBeenCalledTimes(2)
		expect(context.provider.log).toHaveBeenCalledWith(expect.stringContaining("task-1"))
		expect(context.postWebviewState).toHaveBeenCalledOnce()
	})

	it("handles current task export and no-active-task sharing", async () => {
		const exportContext = createContext({ type: "exportCurrentTask" })
		await handleTaskHistoryMessage(exportContext as never)
		expect(exportContext.provider.exportTaskWithId).toHaveBeenCalledWith("active")

		const shareContext = createContext({ type: "shareCurrentTask" })
		shareContext.provider.getCurrentTask.mockReturnValue(undefined)
		await handleTaskHistoryMessage(shareContext as never)
	})
})
