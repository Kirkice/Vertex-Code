import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ProviderSettings } from "@roo-code/types"

import { Task } from "../Task"
import { handoffToMessage } from "../../../services/mode-handoff"

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

		vi.spyOn(task, "attemptApiRequest").mockImplementation(
			async function* () {} as typeof task.attemptApiRequest,
		)

		await task.recursivelyMakeClineRequests([{ type: "text", text: "Continue please" } as any], false)

		const firstCall = mockProcessUserContentMentions.mock.calls[0]?.[0]
		expect(firstCall?.userContent?.[0]?.text).toContain("<mode_handoff>")
		expect(task.clineMessages[0]?.modeHandoff?.consumedAt).toBeDefined()
	})
})
