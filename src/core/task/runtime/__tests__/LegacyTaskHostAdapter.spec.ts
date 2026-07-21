import { describe, expect, it, vi } from "vitest"
import { LegacyTaskHostAdapter } from "../LegacyTaskHostAdapter"
import { TaskRuntimeInvocationGuard } from "../invocationGuard"

describe("LegacyTaskHostAdapter", () => {
	it("delegates state, diagnostics and webview projection without changing legacy provider behavior", async () => {
		const provider = {
			context: { globalStorageUri: { fsPath: "/test/storage" } },
			cwd: "/test/workspace",
			getState: vi.fn().mockResolvedValue({ mode: "code", mcpEnabled: true }),
			log: vi.fn(),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			postStateToWebviewWithoutTaskHistory: vi.fn().mockResolvedValue(undefined),
			on: vi.fn(),
			off: vi.fn(),
		} as any

		const adapter = new LegacyTaskHostAdapter(provider)
		expect(await adapter.getState()).toEqual({ mode: "code", mcpEnabled: true })
		adapter.log("diagnostic")
		await adapter.postMessage({ type: "state", state: {} } as never)
		await adapter.postStateWithoutTaskHistory()

		expect(provider.log).toHaveBeenCalledWith("diagnostic")
		expect(provider.postMessageToWebview).toHaveBeenCalledOnce()
		expect(provider.postStateToWebviewWithoutTaskHistory).toHaveBeenCalledOnce()
	})

	it("subscribes and disposes profile change listeners through the provider event API", () => {
		const provider = {
			context: {},
			cwd: "/test/workspace",
			on: vi.fn(),
			off: vi.fn(),
		} as any
		const listener = vi.fn()
		const adapter = new LegacyTaskHostAdapter(provider)

		const subscription = adapter.onProviderProfileChanged(listener)
		subscription.dispose()

		expect(provider.on).toHaveBeenCalledOnce()
		expect(provider.off).toHaveBeenCalledOnce()
		expect(provider.off).toHaveBeenCalledWith(provider.on.mock.calls[0][0], listener)
	})

	it("exposes profile, mode, routing and legacy feature flag state", async () => {
		const provider = {
			context: {},
			cwd: "/test/workspace",
			getState: vi.fn().mockResolvedValue({
				currentApiConfigName: "vertex",
				apiConfiguration: { apiProvider: "vertex" },
				mode: "architect",
				customModes: [{ slug: "architect" }],
				modeLevelLlmRoutingEnabled: true,
				lockApiConfigAcrossModes: true,
			}),
			updateTaskHistory: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
		} as any
		const adapter = new LegacyTaskHostAdapter(provider)

		expect(await adapter.getCurrentProfileName()).toBe("vertex")
		expect(await adapter.getProfileState()).toEqual({ apiProvider: "vertex" })
		expect(await adapter.getCurrentMode()).toBe("architect")
		expect(await adapter.getAvailableModes()).toEqual([{ slug: "architect" }])
		expect(await adapter.getRoutingState()).toEqual({ enabled: true, locked: true })
		await adapter.updateHistoryItem({ id: "task-1" } as any)
		expect(provider.updateTaskHistory).toHaveBeenCalledWith({ id: "task-1" })
		expect(adapter.getFeatureFlags()).toEqual({
			stateProjection: "legacy",
			profileRouting: "legacy",
			modeHandoff: "legacy",
			historyProjection: "legacy",
			mcp: "legacy",
			skills: "legacy",
			checkpoint: "legacy",
			tools: "legacy",
		})
	})

	it("exposes MCP and Skills read capabilities without executing side effects", async () => {
		const hub = { getServers: vi.fn().mockReturnValue([]) }
		const skills = [{ name: "example", description: "test" }]
		const provider = {
			context: {},
			cwd: "/test/workspace",
			getMcpHub: vi.fn().mockReturnValue(hub),
			getSkillsManager: vi.fn().mockReturnValue({ getSkillsForMode: vi.fn().mockReturnValue(skills) }),
			getState: vi.fn().mockResolvedValue({ mcpEnabled: true }),
		} as any
		const adapter = new LegacyTaskHostAdapter(provider)

		expect(await adapter.getHub()).toBe(hub)
		expect(await adapter.isEnabled()).toBe(true)
		expect(await adapter.getSkillsForMode("code")).toEqual(skills)
	})
})

describe("TaskRuntimeInvocationGuard", () => {
	it("coalesces overlapping calls and permits the next sequential call", async () => {
		const guard = new TaskRuntimeInvocationGuard()
		const operation = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second")

		const [first, second] = await Promise.all([
			guard.run("checkpoint.save", operation),
			guard.run("checkpoint.save", operation),
		])
		expect(first).toBe("first")
		expect(second).toBe("first")
		expect(operation).toHaveBeenCalledOnce()

		await expect(guard.run("checkpoint.save", operation)).resolves.toBe("second")
		expect(operation).toHaveBeenCalledTimes(2)
	})
})
