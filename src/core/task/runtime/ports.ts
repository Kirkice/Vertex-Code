import type * as vscode from "vscode"
import type OpenAI from "openai"
import type { ApiHandler } from "../../../api"
import type { NativeToolExecutionRequest } from "./nativeToolExecutor"
import type {
	ExtensionMessage,
	HistoryItem,
	ModeHandoffTrigger,
	ProviderSettings,
	RooCodeSettings,
	TodoItem,
} from "@roo-code/types"
import type { Task } from "../Task"
import type { McpHub } from "../../../services/mcp/McpHub"
import type { SkillContent, SkillMetadata } from "../../../shared/skills"

/**
 * Stable state snapshot consumed by the Task runtime.
 * Task Runtime 使用稳定的状态快照，避免直接依赖完整 ClineProvider。
 */
export interface TaskRuntimeState {
	mode?: string
	currentApiConfigName?: string
	apiConfiguration?: ProviderSettings
	mcpEnabled?: boolean
	customModes?: unknown[]
	customSupportPrompts?: Record<string, string>
	requestDelaySeconds?: number
	autoApprovalEnabled?: boolean
	modeLevelLlmRoutingEnabled?: boolean
	lockApiConfigAcrossModes?: boolean
	[key: string]: unknown
}

/** Minimal disposable contract used by adapters and tests. */
export interface TaskRuntimeDisposable {
	dispose(): void
}

/** Read-only state and diagnostics capability. */
export interface TaskStatePort {
	getState(): Promise<TaskRuntimeState | undefined>
	log(message: string): void
}

/** Provider event capability without exposing EventEmitter implementation. */
export interface TaskEventPort {
	onProviderProfileChanged(listener: () => void | Promise<void>): TaskRuntimeDisposable
}

/** Webview projection capability. */
export interface TaskWebviewPort {
	postMessage(message: ExtensionMessage): Promise<void> | void
	postStateWithoutTaskHistory(): Promise<void>
}

/**
 * First-stage Task host boundary.
 * This is additive: the legacy ClineProvider path remains the default.
 */
export interface TaskHostPort extends TaskStatePort, TaskEventPort, TaskWebviewPort {
	readonly context: vscode.ExtensionContext
	readonly cwd: string
	readonly settings?: RooCodeSettings
}

/** Combined host capability used while dependency clusters migrate incrementally. */
export interface TaskRuntimeHostPort extends TaskHostPort, TaskDependencyPorts {}

/** Optional lifecycle hook for adapters that need the current Task instance. */
export interface TaskRuntimeTaskBinder {
	bindTask(task: unknown): void
}

/**
 * Explicitly selects the implementation used by a Task dependency cluster.
 * 依赖簇级别的实现选择，默认 legacy，确保现有插件行为不变。
 */
export type TaskRuntimeMode = "legacy" | "shadow" | "new"

export interface TaskRuntimeFeatureFlags {
	readonly stateProjection: TaskRuntimeMode
	/** Read-only profile/routing path; legacy remains the default. */
	readonly profileRouting: TaskRuntimeMode
	/** Read-only mode path; mode switching side effects remain legacy. */
	readonly modeHandoff: TaskRuntimeMode
	/** History persistence path; disabled from the new runtime by default. */
	readonly historyProjection: TaskRuntimeMode
	readonly mcp: TaskRuntimeMode
	readonly skills: TaskRuntimeMode
	readonly checkpoint: TaskRuntimeMode
	readonly tools: TaskRuntimeMode
}

/** Read-only provider profile information required by Task handoff logic. */
export interface TaskProfilePort {
	getCurrentProfileName(): Promise<string | undefined>
	getProfileState(): Promise<ProviderSettings | undefined>
}

/** API client construction boundary owned by the runtime adapter. */
export interface TaskApiPort {
	createApiHandler(configuration: ProviderSettings): ApiHandler
	createMessage(
		handler: ApiHandler,
		...args: Parameters<ApiHandler["createMessage"]>
	): ReturnType<ApiHandler["createMessage"]>
}

/** Mode and routing operations; side effects remain legacy by default. */
export interface TaskModePort {
	getCurrentMode(): Promise<string | undefined>
	getAvailableModes(): Promise<unknown[]>
	getRoutingState(): Promise<{ enabled: boolean; locked: boolean }>
	setMode(mode: string, options?: TaskModeSwitchOptions): Promise<void>
	setProviderProfile(name: string, options?: TaskProfileSwitchOptions): Promise<void>
	handleModeSwitch(mode: string, options?: TaskModeSwitchOptions): Promise<void>
}

export interface TaskModeSwitchOptions {
	createModeHandoff?: boolean
	handoffTrigger?: ModeHandoffTrigger
}

export interface TaskProfileSwitchOptions extends TaskModeSwitchOptions {
	persistModeConfig?: boolean
	persistTaskHistory?: boolean
}

/** MCP access boundary. Tool execution remains on the legacy path until explicitly migrated. */
export interface TaskMcpPort {
	getHub(): Promise<McpHub | undefined>
	isEnabled(): Promise<boolean>
	callTool(serverName: string, toolName: string, arguments_?: Record<string, unknown>): Promise<unknown>
	readResource(serverName: string, uri: string): Promise<unknown>
}

/** Minimal Skills capability consumed by prompt construction. */
export interface TaskSkillsPort {
	getSkillsForMode(mode: string): SkillMetadata[]
	getSkillContent(name: string, currentMode?: string): Promise<SkillContent | null>
}

/** Checkpoint boundary. Implementations must perform each real operation exactly once. */
export interface TaskCheckpointPort {
	enabled(): boolean
	save(force?: boolean, suppressMessage?: boolean): Promise<void> | void
	restore(payload: unknown): Promise<void> | void
	diff(payload: unknown): Promise<void> | void
}

/** Native tool construction boundary; execution stays outside shadow mode. */
export interface TaskToolsPort {
	buildTools(restrictions?: unknown): Promise<OpenAI.Chat.ChatCompletionTool[]> | OpenAI.Chat.ChatCompletionTool[]
	executeNativeTool(request: NativeToolExecutionRequest): Promise<void>
}

/** Task history read/write boundary for the next migration slice. */
export interface TaskRuntimeHistoryPort {
	getHistoryItem(): HistoryItem | undefined
	updateHistoryItem(item: HistoryItem): Promise<void>
}

/** Parent-to-child delegation boundary for the subtask tool. */
export interface TaskSubtaskPort {
	createSubtask(params: {
		parentTaskId: string
		message: string
		initialTodos: TodoItem[]
		mode: string
	}): Promise<Task>
}

export interface TaskDependencyPorts
	extends TaskProfilePort,
		TaskApiPort,
		TaskModePort,
		TaskRuntimeHistoryPort,
		TaskSubtaskPort,
		TaskMcpPort,
		TaskSkillsPort,
		TaskCheckpointPort,
		TaskToolsPort {}
