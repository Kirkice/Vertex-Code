import type OpenAI from "openai"
import { RooCodeEventName, type ExtensionMessage, type HistoryItem, type ProviderSettings } from "@roo-code/types"

import type { ClineProvider } from "../../webview/ClineProvider"
import { buildNativeToolsArrayWithRestrictions } from "../build-tools"
import type {
	TaskDependencyPorts,
	TaskHostPort,
	TaskModeSwitchOptions,
	TaskProfileSwitchOptions,
	TaskRuntimeDisposable,
	TaskRuntimeFeatureFlags,
	TaskRuntimeState,
} from "./ports"

type RuntimeTask = {
	taskId: string
	enableCheckpoints?: boolean
}

/**
 * Production dependency boundary for the migrated Task Runtime slices.
 *
 * This adapter owns the service lookups used by MCP, Skills, Checkpoint and
 * native Tools. The Provider is retained only for host capabilities and for
 * accessing the already-owned service instances; Task no longer selects those
 * services directly on the migrated paths.
 */
export class ProductionTaskRuntimeAdapter implements TaskHostPort, TaskDependencyPorts {
	readonly context
	readonly cwd

	private task?: RuntimeTask

	constructor(private readonly provider: ClineProvider) {
		this.context = provider.context
		this.cwd = provider.cwd
	}

	getFeatureFlags(): TaskRuntimeFeatureFlags {
		return {
			stateProjection: "new",
			profileRouting: "new",
			modeHandoff: "new",
			historyProjection: "new",
			mcp: "new",
			skills: "new",
			checkpoint: "new",
			tools: "new",
		}
	}

	/** Bind exactly one Task instance before checkpoint operations are used. */
	bindTask(task: RuntimeTask): void {
		if (this.task && this.task !== task) {
			throw new Error("ProductionTaskRuntimeAdapter cannot be rebound to another task")
		}
		this.task = task
	}

	private getBoundTask(): RuntimeTask {
		if (!this.task) {
			throw new Error("ProductionTaskRuntimeAdapter is not bound to a Task")
		}
		return this.task
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
		return this.getBoundTask().enableCheckpoints === true
	}

	async save(force = false, suppressMessage = false): Promise<void> {
		const task = this.getBoundTask()
		const { checkpointSave } = await import("../../checkpoints")
		await checkpointSave(task as never, force, suppressMessage)
	}

	async restore(payload: unknown): Promise<void> {
		const task = this.getBoundTask()
		const { checkpointRestore } = await import("../../checkpoints")
		await checkpointRestore(task as never, payload as never)
	}

	async diff(payload: unknown): Promise<void> {
		const task = this.getBoundTask()
		const { checkpointDiff } = await import("../../checkpoints")
		await checkpointDiff(task as never, payload as never)
	}

	async buildTools(restrictions?: unknown): Promise<OpenAI.Chat.ChatCompletionTool[]> {
		const result = await buildNativeToolsArrayWithRestrictions(
			restrictions as Parameters<typeof buildNativeToolsArrayWithRestrictions>[0],
		)
		return result.tools
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
