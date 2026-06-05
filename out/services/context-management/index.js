"use strict";
/**
 * ContextManagementService - Manages context window and compression settings
 * Ported from Zoo-Code with VertexAI naming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextManagementService = exports.DEFAULT_CONTEXT_MANAGEMENT_CONFIG = void 0;
exports.DEFAULT_CONTEXT_MANAGEMENT_CONFIG = {
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
};
class ContextManagementService {
    constructor(config) {
        this.config = { ...exports.DEFAULT_CONTEXT_MANAGEMENT_CONFIG, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
    }
    // Auto-condense
    isAutoCondenseEnabled() {
        return this.config.autoCondenseContext;
    }
    getAutoCondensePercent() {
        return Math.min(Math.max(0, this.config.autoCondenseContextPercent), 100);
    }
    // Context limits
    getMaxOpenTabsContext() {
        return Math.min(Math.max(0, this.config.maxOpenTabsContext), 500);
    }
    getMaxWorkspaceFiles() {
        return Math.min(Math.max(0, this.config.maxWorkspaceFiles), 500);
    }
    // File visibility
    shouldShowIgnoredFiles() {
        return this.config.showVertexIgnoredFiles;
    }
    // Subfolder rules
    areSubfolderRulesEnabled() {
        return this.config.enableSubfolderRules;
    }
    // Image limits
    getMaxImageFileSize() {
        return this.config.maxImageFileSize;
    }
    getMaxTotalImageSize() {
        return this.config.maxTotalImageSize;
    }
    // Profile thresholds
    getProfileThresholds() {
        return { ...this.config.profileThresholds };
    }
    setProfileThreshold(profileId, threshold) {
        this.config.profileThresholds[profileId] = threshold;
    }
    // Diagnostics
    shouldIncludeDiagnostics() {
        return this.config.includeDiagnosticMessages;
    }
    getMaxDiagnostics() {
        return this.config.maxDiagnosticMessages;
    }
    // Write delay
    getWriteDelay() {
        return this.config.writeDelayMs;
    }
    // Time and cost
    shouldIncludeCurrentTime() {
        return this.config.includeCurrentTime;
    }
    shouldIncludeCurrentCost() {
        return this.config.includeCurrentCost;
    }
    // Git status
    getMaxGitStatusFiles() {
        return this.config.maxGitStatusFiles;
    }
    // Custom prompts
    getCustomSupportPrompts() {
        return { ...this.config.customSupportPrompts };
    }
    setCustomSupportPrompt(key, prompt) {
        this.config.customSupportPrompts[key] = prompt;
    }
}
exports.ContextManagementService = ContextManagementService;
//# sourceMappingURL=index.js.map