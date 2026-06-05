/**
 * AutoApproveService - Manages auto-approval settings for tool execution
 * Ported from Zoo-Code with VertexAI naming
 */

export interface AutoApproveConfig {
	// Read operations
	alwaysAllowReadOnly: boolean
	alwaysAllowReadOnlyOutsideWorkspace: boolean

	// Write operations
	alwaysAllowWrite: boolean
	alwaysAllowWriteOutsideWorkspace: boolean
	alwaysAllowWriteProtected: boolean

	// Execute operations
	alwaysAllowExecute: boolean
	allowedCommands: string[]
	deniedCommands: string[]

	// MCP operations
	alwaysAllowMcp: boolean

	// Mode operations
	alwaysAllowModeSwitch: boolean

	// Subtask operations
	alwaysAllowSubtasks: boolean

	// Follow-up questions
	alwaysAllowFollowupQuestions: boolean
	followupAutoApproveTimeoutMs?: number

	// Limits
	allowedMaxRequests?: number
	allowedMaxCost?: number
}

export const DEFAULT_AUTO_APPROVE_CONFIG: AutoApproveConfig = {
	alwaysAllowReadOnly: false,
	alwaysAllowReadOnlyOutsideWorkspace: false,
	alwaysAllowWrite: false,
	alwaysAllowWriteOutsideWorkspace: false,
	alwaysAllowWriteProtected: false,
	alwaysAllowExecute: false,
	allowedCommands: [],
	deniedCommands: [],
	alwaysAllowMcp: false,
	alwaysAllowModeSwitch: false,
	alwaysAllowSubtasks: false,
	alwaysAllowFollowupQuestions: false,
	followupAutoApproveTimeoutMs: undefined,
	allowedMaxRequests: undefined,
	allowedMaxCost: undefined,
}

export class AutoApproveService {
	private config: AutoApproveConfig

	constructor(config?: Partial<AutoApproveConfig>) {
		this.config = { ...DEFAULT_AUTO_APPROVE_CONFIG, ...config }
	}

	getConfig(): AutoApproveConfig {
		return { ...this.config }
	}

	updateConfig(updates: Partial<AutoApproveConfig>): void {
		this.config = { ...this.config, ...updates }
	}

	// Check if a command is allowed
	isCommandAllowed(command: string): boolean {
		// Check denied commands first
		for (const denied of this.config.deniedCommands) {
			if (command.includes(denied)) {
				return false
			}
		}

		// If allowed commands list is empty, all commands are allowed (subject to denied list)
		if (this.config.allowedCommands.length === 0) {
			return true
		}

		// Check if command matches any allowed pattern
		for (const allowed of this.config.allowedCommands) {
			if (command.includes(allowed)) {
				return true
			}
		}

		return false
	}

	// Check if read operation should be auto-approved
	shouldAutoApproveRead(outsideWorkspace: boolean = false): boolean {
		if (!this.config.alwaysAllowReadOnly) {
			return false
		}
		if (outsideWorkspace && !this.config.alwaysAllowReadOnlyOutsideWorkspace) {
			return false
		}
		return true
	}

	// Check if write operation should be auto-approved
	shouldAutoApproveWrite(outsideWorkspace: boolean = false, isProtected: boolean = false): boolean {
		if (!this.config.alwaysAllowWrite) {
			return false
		}
		if (outsideWorkspace && !this.config.alwaysAllowWriteOutsideWorkspace) {
			return false
		}
		if (isProtected && !this.config.alwaysAllowWriteProtected) {
			return false
		}
		return true
	}

	// Check if execute operation should be auto-approved
	shouldAutoApproveExecute(command: string): boolean {
		if (!this.config.alwaysAllowExecute) {
			return false
		}
		return this.isCommandAllowed(command)
	}

	// Check if MCP operation should be auto-approved
	shouldAutoApproveMcp(): boolean {
		return this.config.alwaysAllowMcp
	}

	// Check if mode switch should be auto-approved
	shouldAutoApproveModeSwitch(): boolean {
		return this.config.alwaysAllowModeSwitch
	}

	// Check if subtask should be auto-approved
	shouldAutoApproveSubtask(): boolean {
		return this.config.alwaysAllowSubtasks
	}

	// Check if follow-up question should be auto-approved
	shouldAutoApproveFollowup(): boolean {
		return this.config.alwaysAllowFollowupQuestions
	}

	// Get follow-up auto-approve timeout
	getFollowupTimeout(): number | undefined {
		return this.config.followupAutoApproveTimeoutMs
	}

	// Check if max requests limit is reached
	isMaxRequestsReached(currentRequests: number): boolean {
		if (this.config.allowedMaxRequests === undefined) {
			return false
		}
		return currentRequests >= this.config.allowedMaxRequests
	}

	// Check if max cost limit is reached
	isMaxCostReached(currentCost: number): boolean {
		if (this.config.allowedMaxCost === undefined) {
			return false
		}
		return currentCost >= this.config.allowedMaxCost
	}
}