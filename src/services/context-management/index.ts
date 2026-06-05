/**
 * ContextManagementService - Manages context window and compression settings
 * Ported from Zoo-Code with VertexAI naming
 */

export interface ContextManagementConfig {
	// Auto-condense settings
	autoCondenseContext: boolean
	autoCondenseContextPercent: number

	// Context limits
	maxOpenTabsContext: number
	maxWorkspaceFiles: number

	// File visibility
	showVertexIgnoredFiles: boolean

	// Subfolder rules
	enableSubfolderRules: boolean

	// Image settings
	maxImageFileSize: number
	maxTotalImageSize: number

	// Profile thresholds
	profileThresholds: Record<string, number>

	// Diagnostic messages
	includeDiagnosticMessages: boolean
	maxDiagnosticMessages: number

	// Write delay
	writeDelayMs: number

	// Time and cost inclusion
	includeCurrentTime: boolean
	includeCurrentCost: boolean

	// Git status
	maxGitStatusFiles: number

	// Custom support prompts
	customSupportPrompts: Record<string, string>
}

export const DEFAULT_CONTEXT_MANAGEMENT_CONFIG: ContextManagementConfig = {
	autoCondenseContext: true,
	autoCondenseContextPercent: 100,
	maxOpenTabsContext: 20,
	maxWorkspaceFiles: 200,
	showVertexIgnoredFiles: true,
	enableSubfolderRules: false,
	maxImageFileSize: 5,
	maxTotalImageSize: 20,
	profileThresholds: {},
	includeDiagnosticMessages: true,
	maxDiagnosticMessages: 50,
	writeDelayMs: 1000,
	includeCurrentTime: true,
	includeCurrentCost: true,
	maxGitStatusFiles: 0,
	customSupportPrompts: {},
}

export class ContextManagementService {
	private config: ContextManagementConfig

	constructor(config?: Partial<ContextManagementConfig>) {
		this.config = { ...DEFAULT_CONTEXT_MANAGEMENT_CONFIG, ...config }
	}

	getConfig(): ContextManagementConfig {
		return { ...this.config }
	}

	updateConfig(updates: Partial<ContextManagementConfig>): void {
		this.config = { ...this.config, ...updates }
	}

	// Auto-condense
	isAutoCondenseEnabled(): boolean {
		return this.config.autoCondenseContext
	}

	getAutoCondensePercent(): number {
		return Math.min(Math.max(0, this.config.autoCondenseContextPercent), 100)
	}

	// Context limits
	getMaxOpenTabsContext(): number {
		return Math.min(Math.max(0, this.config.maxOpenTabsContext), 500)
	}

	getMaxWorkspaceFiles(): number {
		return Math.min(Math.max(0, this.config.maxWorkspaceFiles), 500)
	}

	// File visibility
	shouldShowIgnoredFiles(): boolean {
		return this.config.showVertexIgnoredFiles
	}

	// Subfolder rules
	areSubfolderRulesEnabled(): boolean {
		return this.config.enableSubfolderRules
	}

	// Image limits
	getMaxImageFileSize(): number {
		return this.config.maxImageFileSize
	}

	getMaxTotalImageSize(): number {
		return this.config.maxTotalImageSize
	}

	// Profile thresholds
	getProfileThresholds(): Record<string, number> {
		return { ...this.config.profileThresholds }
	}

	setProfileThreshold(profileId: string, threshold: number): void {
		this.config.profileThresholds[profileId] = threshold
	}

	// Diagnostics
	shouldIncludeDiagnostics(): boolean {
		return this.config.includeDiagnosticMessages
	}

	getMaxDiagnostics(): number {
		return this.config.maxDiagnosticMessages
	}

	// Write delay
	getWriteDelay(): number {
		return this.config.writeDelayMs
	}

	// Time and cost
	shouldIncludeCurrentTime(): boolean {
		return this.config.includeCurrentTime
	}

	shouldIncludeCurrentCost(): boolean {
		return this.config.includeCurrentCost
	}

	// Git status
	getMaxGitStatusFiles(): number {
		return this.config.maxGitStatusFiles
	}

	// Custom prompts
	getCustomSupportPrompts(): Record<string, string> {
		return { ...this.config.customSupportPrompts }
	}

	setCustomSupportPrompt(key: string, prompt: string): void {
		this.config.customSupportPrompts[key] = prompt
	}
}