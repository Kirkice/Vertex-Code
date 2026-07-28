import { describe, expect, it, vi } from "vitest"

import { Task } from "../Task"

describe("Task MCP runtime execution boundary", () => {
	it("routes native tool execution through the selected runtime adapter", async () => {
		const executeNativeTool = vi.fn().mockResolvedValue(undefined)
		const task = Object.create(Task.prototype) as Task
		;(task as any).taskRuntimeFeatureFlags = { tools: "new" }
		;(task as any).taskDependencies = { executeNativeTool }

		const request = { task, block: { name: "read_file" } } as any
		await task.executeNativeToolThroughRuntime(request)

		expect(executeNativeTool).toHaveBeenCalledOnce()
		expect(executeNativeTool).toHaveBeenCalledWith(request)
	})

	it("does not retry a failed side-effecting MCP call through legacy", async () => {
		const callTool = vi.fn().mockRejectedValue(new Error("server unavailable"))
		const task = Object.create(Task.prototype) as Task
		;(task as any).taskRuntimeFeatureFlags = { mcp: "new" }
		;(task as any).taskDependencies = { callTool }
		;(task as any).taskHost = { log: vi.fn() }

		await expect(task.callMcpToolThroughRuntime("server", "tool", { value: 1 })).rejects.toThrow(
			"server unavailable",
		)
		expect(callTool).toHaveBeenCalledOnce()
	})

	it("does not retry a failed side-effecting MCP resource read through legacy", async () => {
		const readResource = vi.fn().mockRejectedValue(new Error("resource unavailable"))
		const task = Object.create(Task.prototype) as Task
		;(task as any).taskRuntimeFeatureFlags = { mcp: "new" }
		;(task as any).taskDependencies = { readResource }
		;(task as any).taskHost = { log: vi.fn() }

		await expect(task.readMcpResourceThroughRuntime("server", "file:///tmp/a")).rejects.toThrow(
			"resource unavailable",
		)
		expect(readResource).toHaveBeenCalledOnce()
	})
})
