import type * as vscode from "vscode"
import type { ExtensionMessage, GlobalState, ProviderSettings, RooCodeSettings, WebviewMessage } from "@roo-code/types"

import type { ContextProxy } from "../config/ContextProxy"
import type { ProviderSettingsManager } from "../config/ProviderSettingsManager"
import type { CustomModesManager } from "../config/CustomModesManager"
import type { McpHub } from "../../services/mcp/McpHub"

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
	getCurrentTask(): { cwd?: string } | undefined
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
