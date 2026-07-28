import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ProviderSettings } from "@roo-code/types"

import { Task } from "../Task"
import { handoffToMessage } from "../../../services/mode-handoff"
import { defaultModeSlug } from "../../../shared/modes"

const {
	mockSaveApiMessages,
	mockSaveTaskMessages,
	mockReadApiMessages,
	mockReadTaskMessages,
	mockTaskMetadata,
	mockProcessUserContentMentions,
} = vi.hoisted(() => ({
	mockSaveApiMessages: vi.fn().mockResolvedValue(undefined),
	mockSaveTaskMessages: vi.fn().mockResolvedValue(undefined),
	mockReadApiMessages: vi.fn().mockResolvedValue([]),
	mockReadTaskMessages: vi.fn().mockResolvedValue([]),
	mockTaskMetadata: vi.fn().mockResolvedValue({
		historyItem: { id: "test-task-id", ts: Date.now(), task: "Test task" },
		tokenUsage: {
			totalTokensIn: 0,
			totalTokensOut: 0,
			totalCacheWrites: 0,
			totalCacheReads: 0,
			totalCost: 0,
			contextTokens: 0,
		},
	}),
	mockProcessUserContentMentions: vi.fn().mockImplementation(async ({ userContent }) => ({
		content: userContent,
		mode: undefined,
	})),
}))

vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("p-wait-for", () => ({
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(() => ({
		getModel: () => ({
			id: "test-model",
			info: {
				contextWindow: 128000,
				maxTokens: 4096,
				supportsPromptCache: false,
				supportsImages: true,
			},
		}),
		createMessage: vi.fn(),
	})),
}))

vi.mock("../../task-persistence", () => ({
	saveApiMessages: mockSaveApiMessages,
	saveTaskMessages: mockSaveTaskMessages,
	readApiMessages: mockReadApiMessages,
	readTaskMessages: mockReadTaskMessages,
	taskMetadata: mockTaskMetadata,
}))

vi.mock("../../mentions/processUserContentMentions", () => ({
	processUserContentMentions: mockProcessUserContentMentions,
}))

vi.mock("../../environment/getEnvironmentDetails", () => ({
	getEnvironmentDetails: vi.fn().mockResolvedValue(""),
}))

vi.mock("../../ignore/RooIgnoreController")
vi.mock("../../protect/RooProtectedController")
vi.mock("../../context-tracking/FileContextTracker")
vi.mock("../../../integrations/editor/DiffViewProvider")
vi.mock("../../tools/ToolRepetitionDetector")
vi.mock("vscode", () => ({
	window: {
		createTextEditorDecorationType: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		visibleTextEditors: [],
		tabGroups: { all: [], close: vi.fn(), onDidChangeTabs: vi.fn(() => ({ dispose: vi.fn() })) },
		showErrorMessage: vi.fn(),
	},
	workspace: {
		workspaceFolders: [],
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
			onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
			onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
			dispose: vi.fn(),
		})),
		fs: {
			stat: vi.fn().mockResolvedValue({ type: 1 }),
		},
		onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		getConfiguration: vi.fn(() => ({ get: (_key: string, defaultValue: unknown) => defaultValue })),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
	},
	EventEmitter: vi.fn().mockImplementation(() => ({ event: vi.fn(), fire: vi.fn() })),
	Disposable: { from: vi.fn() },
	TabInputTextDiff: vi.fn(),
	TabInputText: vi.fn(),
	CodeActionKind: {
		QuickFix: { value: "quickfix" },
		RefactorRewrite: { value: "refactor.rewrite" },
	},
}))

describe("Task mode handoff", () => {
	let providerState: {
		mode: string
		currentApiConfigName: string
		apiConfiguration: ProviderSettings
		customModes: never[]
		showRooIgnoredFiles: boolean
		includeDiagnosticMessages: boolean
		maxDiagnosticMessages: number
	}
	let mockProvider: Record<string, any>
	let apiConfiguration: ProviderSettings

	beforeEach(() => {
		vi.clearAllMocks()

		apiConfiguration = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			apiKey: "test-key",
		} as ProviderSettings

		providerState = {
			mode: "code",
			currentApiConfigName: "profile-a",
			apiConfiguration,
			customModes: [],
			showRooIgnoredFiles: false,
			includeDiagnosticMessages: true,
			maxDiagnosticMessages: 50,
		}

		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/tmp/test-storage" },
			},
			getState: vi.fn().mockImplementation(async () => providerState),
			postStateToWebviewWithoutTaskHistory: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			updateTaskHistory: vi.fn().mockResolvedValue(undefined),
			getSkillsManager: vi.fn().mockReturnValue(undefined),
			log: vi.fn(),
		}
	})

	it("routes initialization and profile lifecycle through Runtime ports", async () => {
		let profileListener: (() => void | Promise<void>) | undefined
		const disposeProfileListener = vi.fn()
		const taskHost = {
			context: mockProvider.context,
			cwd: "/tmp/workspace",
			log: vi.fn(),
			onProviderProfileChanged: vi.fn((listener: () => void | Promise<void>) => {
				profileListener = listener
				return { dispose: disposeProfileListener }
			}),
		} as any
		const updatedApiConfiguration = { ...apiConfiguration, apiModelId: "profile-model" }
		const taskDependencies = {
			getCurrentMode: vi.fn().mockResolvedValue("architect"),
			getCurrentProfileName: vi.fn().mockResolvedValue("profile-runtime"),
			getProfileState: vi.fn().mockResolvedValue(updatedApiConfiguration),
		} as any

		const task = new Task({
			provider: mockProvider as any,
			taskHost,
			taskDependencies,
			taskRuntimeFeatureFlags: { modeHandoff: "new", profileRouting: "new" },
			apiConfiguration,
			task: "Runtime lifecycle",
			startTask: false,
		})

		await (task as any).taskModeReady
		await (task as any).taskApiConfigReady
		await profileListener?.()

		expect(task.taskMode).toBe("architect")
		expect((task as any)._taskApiConfigName).toBe("profile-runtime")
		expect(taskDependencies.getCurrentMode).toHaveBeenCalledOnce()
		expect(taskDependencies.getCurrentProfileName).toHaveBeenCalledOnce()
		expect(taskDependencies.getProfileState).toHaveBeenCalledOnce()
		expect(task.apiConfiguration).toEqual(updatedApiConfiguration)
		expect(taskHost.onProviderProfileChanged).toHaveBeenCalledOnce()

		task.dispose()
		expect(disposeProfileListener).toHaveBeenCalledOnce()
	})

	it("creates a structured handoff on submitUserMessage mode/profile switch", async () => {
		const task = new Task({
			provider: mockProvider as any,
			apiConfiguration,
			task: "Test task",
			startTask: false,
		})

		mockProvider.setMode = vi.fn(async (mode: string) => {
			providerState.mode = mode
			;(task as any)._taskMode = mode
		})
		mockProvider.setProviderProfile = vi.fn(async (name: string) => {
			providerState.currentApiConfigName = name
			providerState.apiConfiguration = { ...apiConfiguration, apiModelId: `model-for-${name}` }
			task.setTaskApiConfigName(name)
		})
		;(task as any)._taskMode = "code"
		task.setTaskApiConfigName("profile-a")
		task.clineMessages = [
			{
				ts: 1,
				type: "say",
				say: "text",
				text: "Previous assistant summary",
			},
			{
				ts: 2,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "readFile", path: "src/foo.ts" }),
			},
			{
				ts: 3,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "edit_file", batchDiffs: [{ path: "src/bar.ts" }] }),
			},
		] as any

		vi.spyOn(task as any, "handleWebviewAskResponse").mockImplementation(() => {})

		await task.submitUserMessage("Continue in architect mode", [], "architect", "profile-b")

		expect(mockProvider.setMode).toHaveBeenCalledWith("architect", { createModeHandoff: false })
		expect(mockProvider.setProviderProfile).toHaveBeenCalledWith("profile-b", { createModeHandoff: false })

		const handoffMessage = task.clineMessages.at(-1)
		expect(handoffMessage?.say).toBe("mode_handoff")
		expect(handoffMessage?.modeHandoff).toMatchObject({
			fromMode: "code",
			toMode: "architect",
			fromProfile: "profile-a",
			toProfile: "profile-b",
			trigger: "user_mode_switch",
		})
		expect(handoffMessage?.modeHandoff?.touchedFiles).toEqual(["src/foo.ts", "src/bar.ts"])
	})

	it("does not retry Provider mode operations when Runtime fails", async () => {
		const taskDependencies = {
			setMode: vi.fn().mockRejectedValue(new Error("mode switch unavailable")),
			setProviderProfile: vi.fn().mockRejectedValue(new Error("profile switch unavailable")),
			handleModeSwitch: vi.fn().mockRejectedValue(new Error("handoff unavailable")),
		} as any
		const task = new Task({
			provider: mockProvider as any,
			taskDependencies,
			taskRuntimeFeatureFlags: { modeHandoff: "new", profileRouting: "new" },
			apiConfiguration,
			task: "Runtime failure boundary",
			startTask: false,
		})
		mockProvider.setMode = vi.fn()
		mockProvider.setProviderProfile = vi.fn()
		mockProvider.handleModeSwitch = vi.fn()

		await expect((task as any).setModeThroughRuntime("architect")).rejects.toThrow("mode switch unavailable")
		await expect((task as any).setProviderProfileThroughRuntime("profile-b")).rejects.toThrow(
			"profile switch unavailable",
		)
		await expect((task as any).handleModeSwitchThroughRuntime("architect")).rejects.toThrow("handoff unavailable")

		expect(mockProvider.setMode).not.toHaveBeenCalled()
		expect(mockProvider.setProviderProfile).not.toHaveBeenCalled()
		expect(mockProvider.handleModeSwitch).not.toHaveBeenCalled()
	})

	it("injects the latest pending handoff into the next request and marks it consumed", async () => {
		const task = new Task({
			provider: mockProvider as any,
			apiConfiguration,
			task: "Test task",
			startTask: false,
		})

		task.clineMessages = [
			handoffToMessage({
				handoffId: "handoff-1",
				createdAt: 1000,
				trigger: "user_mode_switch",
				fromMode: "code",
				toMode: "architect",
				fromProfile: "profile-a",
				toProfile: "profile-b",
				objective: "Implement mode handoff",
				completed: ["Added schema"],
				inProgress: ["Wiring request injection"],
				pending: ["Add UI tests"],
				constraints: [],
				touchedFiles: ["src/core/task/Task.ts"],
				openQuestions: [],
				recommendedNextStep: "Continue wiring the next request.",
			}),
		]

		vi.spyOn(task, "attemptApiRequest").mockImplementation(async function* () {} as typeof task.attemptApiRequest)

		await task.recursivelyMakeClineRequests([{ type: "text", text: "Continue please" } as any], false)

		const firstCall = mockProcessUserContentMentions.mock.calls[0]?.[0]
		expect(firstCall?.userContent?.[0]?.text).toContain("<mode_handoff>")
		expect(task.clineMessages[0]?.modeHandoff?.consumedAt).toBeDefined()
	})

	it("keeps injected projections on legacy by default and supports explicit rollback", async () => {
		const taskHost = {
			context: mockProvider.context,
			cwd: "/tmp/workspace",
			postStateWithoutTaskHistory: vi.fn().mockResolvedValue(undefined),
			postMessage: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
			onProviderProfileChanged: vi.fn(() => ({ dispose: vi.fn() })),
		} as any

		const legacyTask = new Task({
			provider: mockProvider as any,
			taskHost,
			apiConfiguration,
			task: "Legacy projection",
			startTask: false,
		})

		await (legacyTask as any).projectStateWithoutTaskHistory()
		await (legacyTask as any).projectWebviewMessage({ type: "state", state: {} })

		expect(taskHost.postStateWithoutTaskHistory).not.toHaveBeenCalled()
		expect(taskHost.postMessage).not.toHaveBeenCalled()
		expect(mockProvider.postStateToWebviewWithoutTaskHistory).toHaveBeenCalledOnce()
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledOnce()

		const newTask = new Task({
			provider: mockProvider as any,
			taskHost,
			taskRuntimeFeatureFlags: { stateProjection: "new" },
			apiConfiguration,
			task: "New projection",
			startTask: false,
		})

		await (newTask as any).projectStateWithoutTaskHistory()
		await (newTask as any).projectWebviewMessage({ type: "state", state: {} })

		expect(taskHost.postStateWithoutTaskHistory).toHaveBeenCalledOnce()
		expect(taskHost.postMessage).toHaveBeenCalledOnce()

		taskHost.postStateWithoutTaskHistory.mockRejectedValueOnce(new Error("webview disposed"))
		taskHost.postMessage.mockRejectedValueOnce(new Error("webview disposed"))
		await expect((newTask as any).projectStateWithoutTaskHistory()).rejects.toThrow("webview disposed")
		await expect((newTask as any).projectWebviewMessage({ type: "state", state: {} })).rejects.toThrow(
			"webview disposed",
		)

		expect(mockProvider.postStateToWebviewWithoutTaskHistory).toHaveBeenCalledOnce()
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledOnce()
		expect(taskHost.log).toHaveBeenCalledTimes(2)
	})

	it("uses Profile and Mode ports only when their clusters are enabled", async () => {
		const taskDependencies = {
			getCurrentMode: vi.fn().mockResolvedValue("architect"),
			getCurrentProfileName: vi.fn().mockResolvedValue("profile-from-port"),
			getProfileState: vi.fn().mockResolvedValue(apiConfiguration),
		} as any
		const taskHost = {
			context: mockProvider.context,
			cwd: "/tmp/workspace",
			log: vi.fn(),
			onProviderProfileChanged: vi.fn(() => ({ dispose: vi.fn() })),
		} as any

		const task = new Task({
			provider: mockProvider as any,
			taskHost,
			taskDependencies,
			taskRuntimeFeatureFlags: { profileRouting: "new", modeHandoff: "new" },
			apiConfiguration,
			task: "Port reads",
			startTask: false,
		})

		await (task as any).taskModeReady
		await (task as any).taskApiConfigReady

		expect(task.taskMode).toBe("architect")
		expect((task as any)._taskApiConfigName).toBe("profile-from-port")
		expect(taskDependencies.getCurrentMode).toHaveBeenCalledOnce()
		expect(taskDependencies.getCurrentProfileName).toHaveBeenCalledOnce()
		expect(mockProvider.getState).not.toHaveBeenCalled()
	})

	it("uses safe defaults when Profile or Mode ports fail", async () => {
		const taskDependencies = {
			getCurrentMode: vi.fn().mockRejectedValue(new Error("mode port unavailable")),
			getCurrentProfileName: vi.fn().mockRejectedValue(new Error("profile port unavailable")),
		} as any
		const taskHost = {
			context: mockProvider.context,
			cwd: "/tmp/workspace",
			log: vi.fn(),
			onProviderProfileChanged: vi.fn(() => ({ dispose: vi.fn() })),
		} as any

		const task = new Task({
			provider: mockProvider as any,
			taskHost,
			taskDependencies,
			taskRuntimeFeatureFlags: { profileRouting: "new", modeHandoff: "new" },
			apiConfiguration,
			task: "Port fallback",
			startTask: false,
		})

		await (task as any).taskModeReady
		await (task as any).taskApiConfigReady

		expect(task.taskMode).toBe(defaultModeSlug)
		expect((task as any)._taskApiConfigName).toBe("default")
		expect(taskHost.log).toHaveBeenCalledTimes(2)
		expect(mockProvider.getState).not.toHaveBeenCalled()
	})

	it("routes History updates through the selected port exactly once", async () => {
		const historyItem = { id: "history-from-metadata", task: "Persisted task" }
		mockTaskMetadata.mockResolvedValueOnce({
			historyItem,
			tokenUsage: {
				totalTokensIn: 0,
				totalTokensOut: 0,
				totalCacheWrites: 0,
				totalCacheReads: 0,
				totalCost: 0,
				contextTokens: 0,
			},
		})
		const updateHistoryItem = vi.fn().mockResolvedValue(undefined)
		const taskDependencies = {
			updateHistoryItem,
		} as any

		const task = new Task({
			provider: mockProvider as any,
			taskDependencies,
			taskRuntimeFeatureFlags: { historyProjection: "new" },
			apiConfiguration,
			task: "History port",
			startTask: false,
		})

		const result = await (task as any).saveClineMessages()

		expect(result).toBe(true)
		expect(updateHistoryItem).toHaveBeenCalledOnce()
		expect(updateHistoryItem).toHaveBeenCalledWith(historyItem)
		expect(mockProvider.updateTaskHistory).not.toHaveBeenCalled()
	})

	it("does not retry History persistence through Provider when the new port fails", async () => {
		const updateHistoryItem = vi.fn().mockRejectedValue(new Error("history port unavailable"))
		const taskHost = {
			context: mockProvider.context,
			cwd: "/tmp/workspace",
			log: vi.fn(),
			onProviderProfileChanged: vi.fn(() => ({ dispose: vi.fn() })),
		} as any
		const task = new Task({
			provider: mockProvider as any,
			taskHost,
			taskDependencies: { updateHistoryItem } as any,
			taskRuntimeFeatureFlags: { historyProjection: "new" },
			apiConfiguration,
			task: "History fallback",
			startTask: false,
		})

		const result = await (task as any).saveClineMessages()

		expect(result).toBe(false)
		expect(updateHistoryItem).toHaveBeenCalledOnce()
		expect(mockProvider.updateTaskHistory).not.toHaveBeenCalled()
		expect(taskHost.log).toHaveBeenCalledWith(expect.stringContaining("Task Runtime history update failed"))
	})

	it("reads MCP state through the new port and preserves disabled behavior", async () => {
		const mcpHub = {
			getServers: vi
				.fn()
				.mockReturnValue([
					{ name: "server-a", status: "connected", tools: [{ name: "tool-a", enabledForPrompt: true }] },
				]),
		}
		const taskDependencies = {
			isEnabled: vi.fn().mockResolvedValue(true),
			getHub: vi.fn().mockResolvedValue(mcpHub),
		} as any
		const task = new Task({
			provider: mockProvider as any,
			taskDependencies,
			taskRuntimeFeatureFlags: { mcp: "new" },
			apiConfiguration,
			task: "MCP port",
			startTask: false,
		})

		expect(await (task as any).getEnabledMcpToolsCount()).toMatchObject({ enabledToolCount: 1 })
		expect(taskDependencies.isEnabled).toHaveBeenCalledOnce()
		expect(taskDependencies.getHub).toHaveBeenCalledOnce()

		taskDependencies.isEnabled.mockResolvedValueOnce(false)
		expect(await (task as any).getEnabledMcpToolsCount()).toEqual({ enabledToolCount: 0, enabledServerCount: 0 })
		expect(taskDependencies.getHub).toHaveBeenCalledOnce()
	})

	it("keeps MCP failures non-fatal and returns an empty count", async () => {
		const taskHost = { log: vi.fn() } as any
		const task = new Task({
			provider: mockProvider as any,
			taskHost,
			taskDependencies: {
				isEnabled: vi.fn().mockRejectedValue(new Error("MCP unavailable")),
				getHub: vi.fn(),
			} as any,
			taskRuntimeFeatureFlags: { mcp: "new" },
			apiConfiguration,
			task: "MCP failure",
			startTask: false,
		})

		expect(await (task as any).getEnabledMcpToolsCount()).toEqual({ enabledToolCount: 0, enabledServerCount: 0 })
	})

	it("routes slash-command skill lookup through the Skills port when enabled", async () => {
		const getSkillContent = vi.fn().mockResolvedValue({
			name: "review",
			source: "project",
			description: "Review changes",
			instructions: "Review the diff carefully.",
		})
		const taskDependencies = { getSkillContent } as any
		const task = new Task({
			provider: mockProvider as any,
			taskDependencies,
			taskRuntimeFeatureFlags: { skills: "new" },
			apiConfiguration,
			task: "Skills port",
			startTask: false,
		})

		const result = await (task as any).getSkillsLookup(mockProvider).getSkillContent("review", "code")

		expect(result).toMatchObject({ name: "review", source: "project" })
		expect(getSkillContent).toHaveBeenCalledWith("review", "code")
		expect(mockProvider.getSkillsManager).not.toHaveBeenCalled()
	})

	it("does not retry Skills lookup through the legacy Manager when the port fails", async () => {
		const legacyManager = { getSkillContent: vi.fn().mockResolvedValue({ name: "legacy" }) }
		mockProvider.getSkillsManager.mockReturnValue(legacyManager)
		const taskHost = { log: vi.fn() } as any
		const task = new Task({
			provider: mockProvider as any,
			taskHost,
			taskDependencies: {
				getSkillContent: vi.fn().mockRejectedValue(new Error("skills port unavailable")),
			} as any,
			taskRuntimeFeatureFlags: { skills: "new" },
			apiConfiguration,
			task: "Skills fallback",
			startTask: false,
		})

		await expect((task as any).getSkillsLookup(mockProvider).getSkillContent("review", "code")).rejects.toThrow(
			"skills port unavailable",
		)
		expect(legacyManager.getSkillContent).not.toHaveBeenCalled()
		expect(taskHost.log).not.toHaveBeenCalledWith(expect.stringContaining("fallback"))
	})

	it("falls back to the legacy Skills Manager when Skills port is disabled", async () => {
		const legacyManager = { getSkillContent: vi.fn().mockResolvedValue({ name: "legacy" }) }
		mockProvider.getSkillsManager.mockReturnValue(legacyManager)
		const task = new Task({
			provider: mockProvider as any,
			taskRuntimeFeatureFlags: { skills: "legacy" },
			apiConfiguration,
			task: "Legacy skills",
			startTask: false,
		})

		const lookup = (task as any).getSkillsLookup(mockProvider)
		expect(await lookup.getSkillContent("legacy", "code")).toEqual({ name: "legacy" })
		expect(legacyManager.getSkillContent).toHaveBeenCalledWith("legacy", "code")
	})

	it("routes checkpoint operations through the new port without retrying on failure", async () => {
		const save = vi.fn().mockResolvedValue(undefined)
		const restore = vi.fn().mockResolvedValue(undefined)
		const diff = vi.fn().mockResolvedValue(undefined)
		const taskHost = { log: vi.fn() } as any
		const task = new Task({
			provider: mockProvider as any,
			taskHost,
			taskDependencies: { enabled: vi.fn().mockReturnValue(true), save, restore, diff } as any,
			taskRuntimeFeatureFlags: { checkpoint: "new" },
			apiConfiguration,
			task: "Checkpoint port",
			startTask: false,
		})

		await task.checkpointSave(true, true)
		await task.checkpointRestore({} as any)
		await task.checkpointDiff({} as any)

		expect(save).toHaveBeenCalledWith(true, true)
		expect(restore).toHaveBeenCalledOnce()
		expect(diff).toHaveBeenCalledOnce()

		await Promise.all([task.checkpointSave(), task.checkpointSave()])
		expect(save).toHaveBeenCalledTimes(2)

		save.mockRejectedValueOnce(new Error("checkpoint unavailable"))
		await expect(task.checkpointSave()).rejects.toThrow("checkpoint unavailable")
		expect(taskHost.log).not.toHaveBeenCalledWith(expect.stringContaining("fallback"))
	})

	it("routes tool construction through the new port without retrying on failure", async () => {
		mockProvider.getMcpHub = vi.fn().mockReturnValue(undefined)
		const tools = [{ type: "function", function: { name: "read_file", parameters: {} } }] as any
		const buildTools = vi.fn().mockResolvedValue(tools)
		const taskHost = { log: vi.fn() } as any
		const task = new Task({
			provider: mockProvider as any,
			taskHost,
			taskDependencies: { buildTools } as any,
			taskRuntimeFeatureFlags: { tools: "new" },
			apiConfiguration,
			task: "Tools port",
			startTask: false,
		})

		const result = await (task as any).buildToolsWithRuntime({ provider: mockProvider, cwd: "/tmp/workspace" })
		expect(result.tools).toBe(tools)
		expect(buildTools).toHaveBeenCalledOnce()

		buildTools.mockRejectedValueOnce(new Error("tool builder unavailable"))
		await expect(
			(task as any).buildToolsWithRuntime({
				provider: mockProvider,
				cwd: "/tmp/workspace",
			}),
		).rejects.toThrow("tool builder unavailable")
		expect(taskHost.log).not.toHaveBeenCalledWith(expect.stringContaining("fallback"))
	})

	it("uses the State/Webview ports for message projection when stateProjection is new", async () => {
		const taskHost = {
			context: mockProvider.context,
			cwd: "/tmp/workspace",
			postStateWithoutTaskHistory: vi.fn().mockResolvedValue(undefined),
			postMessage: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
			onProviderProfileChanged: vi.fn(() => ({ dispose: vi.fn() })),
		} as any
		const task = new Task({
			provider: mockProvider as any,
			taskHost,
			taskRuntimeFeatureFlags: { stateProjection: "new" },
			apiConfiguration,
			task: "State projection",
			startTask: false,
		})

		await (task as any).projectStateWithoutTaskHistory()
		await (task as any).projectWebviewMessage({ type: "state", state: {} })

		expect(taskHost.postStateWithoutTaskHistory).toHaveBeenCalledOnce()
		expect(taskHost.postMessage).toHaveBeenCalledOnce()
		expect(mockProvider.postStateToWebviewWithoutTaskHistory).not.toHaveBeenCalled()
		expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
	})
})
