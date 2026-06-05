"use strict";
/**
 * AutoApproveService - Manages auto-approval settings for tool execution
 * Ported from Zoo-Code with VertexAI naming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoApproveService = exports.DEFAULT_AUTO_APPROVE_CONFIG = void 0;
exports.DEFAULT_AUTO_APPROVE_CONFIG = {
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
};
class AutoApproveService {
    constructor(config) {
        this.config = { ...exports.DEFAULT_AUTO_APPROVE_CONFIG, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
    }
    // Check if a command is allowed
    isCommandAllowed(command) {
        // Check denied commands first
        for (const denied of this.config.deniedCommands) {
            if (command.includes(denied)) {
                return false;
            }
        }
        // If allowed commands list is empty, all commands are allowed (subject to denied list)
        if (this.config.allowedCommands.length === 0) {
            return true;
        }
        // Check if command matches any allowed pattern
        for (const allowed of this.config.allowedCommands) {
            if (command.includes(allowed)) {
                return true;
            }
        }
        return false;
    }
    // Check if read operation should be auto-approved
    shouldAutoApproveRead(outsideWorkspace = false) {
        if (!this.config.alwaysAllowReadOnly) {
            return false;
        }
        if (outsideWorkspace && !this.config.alwaysAllowReadOnlyOutsideWorkspace) {
            return false;
        }
        return true;
    }
    // Check if write operation should be auto-approved
    shouldAutoApproveWrite(outsideWorkspace = false, isProtected = false) {
        if (!this.config.alwaysAllowWrite) {
            return false;
        }
        if (outsideWorkspace && !this.config.alwaysAllowWriteOutsideWorkspace) {
            return false;
        }
        if (isProtected && !this.config.alwaysAllowWriteProtected) {
            return false;
        }
        return true;
    }
    // Check if execute operation should be auto-approved
    shouldAutoApproveExecute(command) {
        if (!this.config.alwaysAllowExecute) {
            return false;
        }
        return this.isCommandAllowed(command);
    }
    // Check if MCP operation should be auto-approved
    shouldAutoApproveMcp() {
        return this.config.alwaysAllowMcp;
    }
    // Check if mode switch should be auto-approved
    shouldAutoApproveModeSwitch() {
        return this.config.alwaysAllowModeSwitch;
    }
    // Check if subtask should be auto-approved
    shouldAutoApproveSubtask() {
        return this.config.alwaysAllowSubtasks;
    }
    // Check if follow-up question should be auto-approved
    shouldAutoApproveFollowup() {
        return this.config.alwaysAllowFollowupQuestions;
    }
    // Get follow-up auto-approve timeout
    getFollowupTimeout() {
        return this.config.followupAutoApproveTimeoutMs;
    }
    // Check if max requests limit is reached
    isMaxRequestsReached(currentRequests) {
        if (this.config.allowedMaxRequests === undefined) {
            return false;
        }
        return currentRequests >= this.config.allowedMaxRequests;
    }
    // Check if max cost limit is reached
    isMaxCostReached(currentCost) {
        if (this.config.allowedMaxCost === undefined) {
            return false;
        }
        return currentCost >= this.config.allowedMaxCost;
    }
}
exports.AutoApproveService = AutoApproveService;
//# sourceMappingURL=index.js.map