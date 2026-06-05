/**
 * UIService - Manages UI settings
 * Ported from Zoo-Code with VertexAI naming
 */

export interface UIConfig {
	chatFontSize: number | null
	enterBehavior: "send" | "newline"
	reasoningBlockCollapsed: boolean
	historyPreviewCollapsed: boolean
}

export const DEFAULT_UI_CONFIG: UIConfig = {
	chatFontSize: null,
	enterBehavior: "send",
	reasoningBlockCollapsed: true,
	historyPreviewCollapsed: false,
}

export class UIService {
	private config: UIConfig

	constructor(config?: Partial<UIConfig>) {
		this.config = { ...DEFAULT_UI_CONFIG, ...config }
	}

	getConfig(): UIConfig {
		return { ...this.config }
	}

	updateConfig(updates: Partial<UIConfig>): void {
		this.config = { ...this.config, ...updates }
	}

	getChatFontSize(): number | null {
		return this.config.chatFontSize
	}

	setChatFontSize(size: number | null): void {
		this.config.chatFontSize = size
	}

	getEnterBehavior(): "send" | "newline" {
		return this.config.enterBehavior
	}

	setEnterBehavior(behavior: "send" | "newline"): void {
		this.config.enterBehavior = behavior
	}

	isReasoningBlockCollapsed(): boolean {
		return this.config.reasoningBlockCollapsed
	}

	setReasoningBlockCollapsed(collapsed: boolean): void {
		this.config.reasoningBlockCollapsed = collapsed
	}

	isHistoryPreviewCollapsed(): boolean {
		return this.config.historyPreviewCollapsed
	}

	setHistoryPreviewCollapsed(collapsed: boolean): void {
		this.config.historyPreviewCollapsed = collapsed
	}
}