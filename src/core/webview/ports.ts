import type * as vscode from "vscode"
import type { ExtensionMessage, GlobalState, ProviderSettings, RooCodeSettings, WebviewMessage } from "@roo-code/types"

import type { ContextProxy } from "../config/ContextProxy"
import type { ProviderSettingsManager } from "../config/ProviderSettingsManager"
import type { CustomModesManager } from "../config/CustomModesManager"
import type { McpHub } from "../../services/mcp/McpHub"

export interface WorktreeHostPort {
	readonly cwd: string
	readonly contextProxy: ContextProxy
	log(message: string): void
}

export interface CheckpointTaskPort {
	readonly cwd?: string
	readonly isInitialized?: boolean
	checkpointDiff(payload: unknown): Promise<void> | void
	checkpointRestore(payload: unknown): Promise<void> | void
}

export interface TaskHistoryPort {
	getCurrentTask(): { taskId?: string } | undefined
	clearTask(): Promise<void>
	exportTaskWithId(id: string): Promise<void>
	showTaskWithId(id: string): Promise<void>
	condenseTaskContext(id: string): Promise<void>
	deleteTaskWithId(id: string): Promise<void>
	getTaskWithAggregatedCosts(id: string): Promise<Record<string, unknown>>
	log(message: string): void
}

/**
 * Narrow read-only state port for future Task runtime extraction.
 *
 * Task runtime 后续迁移使用的只读状态端口；本阶段只定义稳定边界，
 * 不把完整 Provider 类型强行替换到 Task 主循环中。
 */
export interface TaskStatePort {
	getState(): Promise<{
		mode?: string
		currentApiConfigName?: string
		apiConfiguration?: Record<string, unknown>
		mcpEnabled?: boolean
		customModes?: unknown[]
		customSupportPrompts?: Record<string, string>
		requestDelaySeconds?: number
		autoApprovalEnabled?: boolean
	}>
	log(message: string): void
}

/**
 * Webview message handlers should depend on a minimal host contract instead of the
 * full provider implementation.
 *
 * Webview 消息处理器应依赖最小宿主接口，而不是完整的 Provider 实现。
 * 这样可以降低模块耦合，便于后续把大型 handler 继续拆分成独立应用服务。
 */
export interface WebviewHostPort {
	readonly context: vscode.ExtensionContext
	readonly contextProxy: ContextProxy
	readonly providerSettingsManager: ProviderSettingsManager
	readonly customModesManager: CustomModesManager
	readonly cwd: string

	getState(): Promise<{
		apiConfiguration: Record<string, any>
	}>
	postMessageToWebview(message: ExtensionMessage): Promise<void> | void
	postStateToWebview(): Promise<void>
	log(message: string): void
	getCurrentTask(): (CheckpointTaskPort & { taskId?: string }) | undefined
	cancelTask(): Promise<void>
	getMcpHub(): McpHub | undefined
	upsertProviderProfile(name: string, settings: ProviderSettings): Promise<string | undefined>
	activateProviderProfile(args: { name: string } | { id: string }): Promise<void>
}

/**
 * Shared helpers needed by extracted handlers.
 *
 * 被拆分出来的 handler 仍然需要访问少量共享能力，统一放在这个上下文中。
 */
export interface WebviewHandlerContext {
	provider: WebviewHostPort
	message: WebviewMessage
	getCurrentCwd(): string
	getGlobalState<K extends keyof GlobalState>(key: K): GlobalState[K] | undefined
	updateGlobalState<K extends keyof GlobalState>(key: K, value: GlobalState[K]): Promise<void>
	postWebviewState(): Promise<void>
	postWebviewMessage(message: ExtensionMessage): Promise<void>
	setSetting<K extends keyof RooCodeSettings>(key: K, value: RooCodeSettings[K]): Promise<void>
}
