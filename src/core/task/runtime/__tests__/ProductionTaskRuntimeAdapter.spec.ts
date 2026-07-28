import { describe, expect, it, vi } from "vitest"

const { mockCheckpointSave, mockCheckpointRestore, mockCheckpointDiff, mockBuildTools, mockBuildApiHandler } =
	vi.hoisted(() => ({
		mockCheckpointSave: vi.fn().mockResolvedValue(undefined),
		mockCheckpointRestore: vi.fn().mockResolvedValue(undefined),
		mockCheckpointDiff: vi.fn().mockResolvedValue(undefined),
		mockBuildApiHandler: vi
			.fn()
			.mockReturnValue({ createMessage: vi.fn(), getModel: vi.fn(), countTokens: vi.fn() }),
		mockBuildTools: vi.fn().mockResolvedValue({
			tools: [{ type: "function", function: { name: "read_file", parameters: {} } }],
		}),
	}))

vi.mock("../../../checkpoints", () => ({
	checkpointSave: mockCheckpointSave,
	checkpointRestore: mockCheckpointRestore,
	checkpointDiff: mockCheckpointDiff,
}))

vi.mock("../../build-tools", () => ({
	buildNativeToolsArrayWithRestrictions: mockBuildTools,
}))

vi.mock("../../../../api", () => ({
	buildApiHandler: mockBuildApiHandler,
}))

import { ProductionTaskRuntimeAdapter } from "../ProductionTaskRuntimeAdapter"

describe("ProductionTaskRuntimeAdapter", () => {
	it("selects the migrated production paths while keeping host projection legacy", () => {
		const adapter = new ProductionTaskRuntimeAdapter({} as any)

		expect(adapter.getFeatureFlags()).toEqual({
			stateProjection: "new",
			profileRouting: "new",
			modeHandoff: "new",
			historyProjection: "new",
			mcp: "new",
			skills: "new",
			checkpoint: "new",
			tools: "new",
		})
	})

	it("routes MCP, Skills and native Tools through owned service boundaries", async () => {
		const hub = {
			getServers: vi.fn().mockReturnValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] }),
			readResource: vi.fn().mockResolvedValue({ contents: [{ text: "resource" }] }),
		}
		const skillManager = {
			getSkillsForMode: vi.fn().mockReturnValue([{ name: "review" }]),
			getSkillContent: vi.fn().mockResolvedValue({ name: "review", source: "project" }),
		}
		const provider = {
			context: { globalStorageUri: { fsPath: "/tmp/storage" } },
			cwd: "/tmp/workspace",
			getState: vi.fn().mockResolvedValue({ mode: "code", mcpEnabled: true }),
			getMcpHub: vi.fn().mockReturnValue(hub),
			getSkillsManager: vi.fn().mockReturnValue(skillManager),
		} as any
		const adapter = new ProductionTaskRuntimeAdapter(provider)

		expect(await adapter.getHub()).toBe(hub)
		expect(await adapter.isEnabled()).toBe(true)
		expect(await adapter.getSkillsForMode("code")).toEqual([{ name: "review" }])
		expect(await adapter.getSkillContent("review", "code")).toMatchObject({ name: "review" })
		await expect(adapter.callTool("server", "tool", { value: 1 })).resolves.toEqual({
			content: [{ type: "text", text: "ok" }],
		})
		await expect(adapter.readResource("server", "file:///tmp/a")).resolves.toEqual({
			contents: [{ text: "resource" }],
		})
		expect(hub.callTool).toHaveBeenCalledWith("server", "tool", { value: 1 })
		expect(hub.readResource).toHaveBeenCalledWith("server", "file:///tmp/a")
		await expect(adapter.buildTools({ provider, cwd: "/tmp/workspace" })).resolves.toEqual([
			{ type: "function", function: { name: "read_file", parameters: {} } },
		])
		expect(mockBuildTools).toHaveBeenCalledOnce()
	})

	it("creates API handlers through the runtime boundary", () => {
		const adapter = new ProductionTaskRuntimeAdapter({} as any)
		const configuration = { apiProvider: "fake-ai" } as any

		expect(adapter.createApiHandler(configuration)).toBe(mockBuildApiHandler.mock.results.at(-1)?.value)
		expect(mockBuildApiHandler).toHaveBeenCalledWith(configuration)
	})

	it("routes subtask delegation through the runtime boundary", async () => {
		const child = { taskId: "child-1" } as any
		const delegateParentAndOpenChild = vi.fn().mockResolvedValue(child)
		const adapter = new ProductionTaskRuntimeAdapter({ delegateParentAndOpenChild } as any)
		const params = {
			parentTaskId: "parent-1",
			message: "child task",
			initialTodos: [],
			mode: "code",
		}

		await expect(adapter.createSubtask(params)).resolves.toBe(child)
		expect(delegateParentAndOpenChild).toHaveBeenCalledWith(params)
	})

	it("starts API streams through the same runtime boundary", async () => {
		const createMessage = vi.fn().mockReturnValue(
			(async function* () {
				yield { type: "text", text: "ok" }
			})(),
		)
		const adapter = new ProductionTaskRuntimeAdapter({} as any)
		const handler = { createMessage } as any

		const stream = adapter.createMessage(handler, "system", [{ role: "user", content: "hello" }], {
			taskId: "task-1",
		})
		await expect(stream.next()).resolves.toEqual({ value: { type: "text", text: "ok" }, done: false })
		expect(createMessage).toHaveBeenCalledWith("system", [{ role: "user", content: "hello" }], { taskId: "task-1" })
	})

	it("binds one Task and routes checkpoint operations exactly once", async () => {
		const adapter = new ProductionTaskRuntimeAdapter({
			context: { globalStorageUri: { fsPath: "/tmp/storage" } },
			cwd: "/tmp/workspace",
		} as any)
		const task = { taskId: "task-1", enableCheckpoints: true }
		adapter.bindTask(task)

		await adapter.save(true, true)
		await adapter.restore({ ts: 1, commitHash: "abc", mode: "preview" })
		await adapter.diff({ commitHash: "abc", mode: "to-current" })

		expect(mockCheckpointSave).toHaveBeenCalledWith(task, true, true)
		expect(mockCheckpointRestore).toHaveBeenCalledWith(task, {
			ts: 1,
			commitHash: "abc",
			mode: "preview",
		})
		expect(mockCheckpointDiff).toHaveBeenCalledWith(task, { commitHash: "abc", mode: "to-current" })
		expect(adapter.enabled()).toBe(true)
		await expect(adapter.save()).resolves.toBeUndefined()
	})

	it("rejects an unbound checkpoint call so Task can use its legacy fallback", async () => {
		const adapter = new ProductionTaskRuntimeAdapter({} as any)

		await expect(adapter.save()).rejects.toThrow("not bound to a Task")
	})
})
