import { RooCodeEventName, type ExtensionMessage, type HistoryItem, type ProviderSettings } from "@roo-code/types"
import type { ClineProvider } from "../../webview/ClineProvider"
import type {
	TaskDependencyPorts,
	TaskHostPort,
	TaskModeSwitchOptions,
	TaskProfileSwitchOptions,
	TaskRuntimeDisposable,
	TaskRuntimeState,
} from "./ports"

/**
 * Compatibility adapter for the existing Provider implementation.
 * 兼容适配器：新 Runtime 通过窄端口访问旧 Provider，默认不改变生产路径。
 */
export class LegacyTaskHostAdapter implements TaskHostPort, TaskDependencyPorts {
	readonly context
	readonly cwd

	constructor(private readonly provider: ClineProvider) {
		this.context = provider.context
		this.cwd = provider.cwd
	}

	/** Return the legacy default without changing production routing. */
	getFeatureFlags(): {
		stateProjection: "legacy"
		profileRouting: "legacy"
		modeHandoff: "legacy"
		historyProjection: "legacy"
		mcp: "legacy"
		skills: "legacy"
		checkpoint: "legacy"
		tools: "legacy"
	} {
		return {
			stateProjection: "legacy",
			profileRouting: "legacy",
			modeHandoff: "legacy",
			historyProjection: "legacy",
			mcp: "legacy",
			skills: "legacy",
			checkpoint: "legacy",
			tools: "legacy",
		}
	}

	async getCurrentProfileName(): Promise<string | undefined> {
		return (await this.provider.getState()).currentApiConfigName
	}

	async getProfileState(): Promise<ProviderSettings | undefined> {
		return (await this.provider.getState()).apiConfiguration
	}

	async getCurrentMode(): Promise<string | undefined> {
		return (await this.provider.getState()).mode
	}

	async getAvailableModes(): Promise<unknown[]> {
		return (await this.provider.getState()).customModes ?? []
	}

	async getRoutingState(): Promise<{ enabled: boolean; locked: boolean }> {
		const state = await this.provider.getState()
		return {
			enabled: state.modeLevelLlmRoutingEnabled ?? false,
			locked: state.lockApiConfigAcrossModes ?? false,
		}
	}

	async setMode(mode: string, options?: TaskModeSwitchOptions): Promise<void> {
		await this.provider.setMode(mode, options)
	}

	async setProviderProfile(name: string, options?: TaskProfileSwitchOptions): Promise<void> {
		await this.provider.setProviderProfile(name, options)
	}

	async handleModeSwitch(mode: string, options?: TaskModeSwitchOptions): Promise<void> {
		await this.provider.handleModeSwitch(mode as Parameters<ClineProvider["handleModeSwitch"]>[0], options)
	}

	async getHub() {
		return this.provider.getMcpHub()
	}

	async isEnabled(): Promise<boolean> {
		return (await this.provider.getState()).mcpEnabled ?? false
	}

	getSkillsForMode(mode: string) {
		return this.provider.getSkillsManager()?.getSkillsForMode(mode) ?? []
	}

	async getSkillContent(name: string, currentMode?: string) {
		return (await this.provider.getSkillsManager()?.getSkillContent(name, currentMode)) ?? null
	}

	enabled(): boolean {
		return true
	}

	async save(): Promise<void> {
		throw new Error("Checkpoint adapter is not wired into the legacy host yet")
	}

	async restore(): Promise<void> {
		throw new Error("Checkpoint adapter is not wired into the legacy host yet")
	}

	async diff(): Promise<void> {
		throw new Error("Checkpoint adapter is not wired into the legacy host yet")
	}

	buildTools(): never[] {
		return []
	}

	getHistoryItem(): HistoryItem | undefined {
		return undefined
	}

	async updateHistoryItem(item: HistoryItem): Promise<void> {
		await this.provider.updateTaskHistory(item)
	}

	async getState(): Promise<TaskRuntimeState | undefined> {
		return (await this.provider.getState()) as TaskRuntimeState
	}

	log(message: string): void {
		this.provider.log(message)
	}

	postMessage(message: ExtensionMessage): Promise<void> | void {
		return this.provider.postMessageToWebview(message)
	}

	postStateWithoutTaskHistory(): Promise<void> {
		return this.provider.postStateToWebviewWithoutTaskHistory()
	}

	onProviderProfileChanged(listener: () => void | Promise<void>): TaskRuntimeDisposable {
		const eventName = RooCodeEventName.ProviderProfileChanged
		this.provider.on(eventName, listener)

		return {
			dispose: () => {
				this.provider.off(eventName, listener)
			},
		}
	}
}
