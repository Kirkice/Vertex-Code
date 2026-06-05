/**
 * TerminalService - Manages terminal execution settings
 * Ported from Zoo-Code with VertexAI naming
 */

export interface TerminalConfig {
	// Shell integration
	terminalShellIntegrationTimeout: number
	terminalShellIntegrationDisabled: boolean

	// Command execution
	terminalCommandDelay: number
	terminalOutputPreviewSize: "small" | "medium" | "large"

	// Zsh settings
	terminalZshClearEolMark: boolean
	terminalZshOhMy: boolean
	terminalZshP10k: boolean
	terminalZdotdir: boolean

	// Terminal profile
	terminalProfile: string
}

export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
	terminalShellIntegrationTimeout: 4000,
	terminalShellIntegrationDisabled: false,
	terminalCommandDelay: 0,
	terminalOutputPreviewSize: "medium",
	terminalZshClearEolMark: false,
	terminalZshOhMy: false,
	terminalZshP10k: false,
	terminalZdotdir: false,
	terminalProfile: "",
}

export class TerminalService {
	private config: TerminalConfig

	constructor(config?: Partial<TerminalConfig>) {
		this.config = { ...DEFAULT_TERMINAL_CONFIG, ...config }
	}

	getConfig(): TerminalConfig {
		return { ...this.config }
	}

	updateConfig(updates: Partial<TerminalConfig>): void {
		this.config = { ...this.config, ...updates }
	}

	// Shell integration
	getShellIntegrationTimeout(): number {
		return this.config.terminalShellIntegrationTimeout
	}

	isShellIntegrationDisabled(): boolean {
		return this.config.terminalShellIntegrationDisabled
	}

	// Command execution
	getCommandDelay(): number {
		return this.config.terminalCommandDelay
	}

	getOutputPreviewSize(): "small" | "medium" | "large" {
		return this.config.terminalOutputPreviewSize
	}

	// Zsh settings
	shouldClearZshEolMark(): boolean {
		return this.config.terminalZshClearEolMark
	}

	isOhMyZshEnabled(): boolean {
		return this.config.terminalZshOhMy
	}

	isPowerlevel10kEnabled(): boolean {
		return this.config.terminalZshP10k
	}

	isZdotdirEnabled(): boolean {
		return this.config.terminalZdotdir
	}

	// Terminal profile
	getTerminalProfile(): string {
		return this.config.terminalProfile
	}
}