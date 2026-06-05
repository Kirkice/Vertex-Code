"use strict";
/**
 * TerminalService - Manages terminal execution settings
 * Ported from Zoo-Code with VertexAI naming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalService = exports.DEFAULT_TERMINAL_CONFIG = void 0;
exports.DEFAULT_TERMINAL_CONFIG = {
    terminalShellIntegrationTimeout: 4000,
    terminalShellIntegrationDisabled: false,
    terminalCommandDelay: 0,
    terminalOutputPreviewSize: "medium",
    terminalZshClearEolMark: false,
    terminalZshOhMy: false,
    terminalZshP10k: false,
    terminalZdotdir: false,
    terminalProfile: "",
};
class TerminalService {
    constructor(config) {
        this.config = { ...exports.DEFAULT_TERMINAL_CONFIG, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
    }
    // Shell integration
    getShellIntegrationTimeout() {
        return this.config.terminalShellIntegrationTimeout;
    }
    isShellIntegrationDisabled() {
        return this.config.terminalShellIntegrationDisabled;
    }
    // Command execution
    getCommandDelay() {
        return this.config.terminalCommandDelay;
    }
    getOutputPreviewSize() {
        return this.config.terminalOutputPreviewSize;
    }
    // Zsh settings
    shouldClearZshEolMark() {
        return this.config.terminalZshClearEolMark;
    }
    isOhMyZshEnabled() {
        return this.config.terminalZshOhMy;
    }
    isPowerlevel10kEnabled() {
        return this.config.terminalZshP10k;
    }
    isZdotdirEnabled() {
        return this.config.terminalZdotdir;
    }
    // Terminal profile
    getTerminalProfile() {
        return this.config.terminalProfile;
    }
}
exports.TerminalService = TerminalService;
//# sourceMappingURL=index.js.map