"use strict";
/**
 * WorktreesService - Manages Git worktree settings
 * Ported from Zoo-Code with VertexAI naming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorktreesService = exports.DEFAULT_WORKTREES_CONFIG = void 0;
exports.DEFAULT_WORKTREES_CONFIG = {
    showWorktreesInHomeScreen: true,
};
class WorktreesService {
    constructor(config) {
        this.config = { ...exports.DEFAULT_WORKTREES_CONFIG, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
    }
    shouldShowInHomeScreen() {
        return this.config.showWorktreesInHomeScreen;
    }
}
exports.WorktreesService = WorktreesService;
//# sourceMappingURL=index.js.map