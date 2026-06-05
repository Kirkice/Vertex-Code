"use strict";
/**
 * UIService - Manages UI settings
 * Ported from Zoo-Code with VertexAI naming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UIService = exports.DEFAULT_UI_CONFIG = void 0;
exports.DEFAULT_UI_CONFIG = {
    chatFontSize: null,
    enterBehavior: "send",
    reasoningBlockCollapsed: true,
    historyPreviewCollapsed: false,
};
class UIService {
    constructor(config) {
        this.config = { ...exports.DEFAULT_UI_CONFIG, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
    }
    getChatFontSize() {
        return this.config.chatFontSize;
    }
    setChatFontSize(size) {
        this.config.chatFontSize = size;
    }
    getEnterBehavior() {
        return this.config.enterBehavior;
    }
    setEnterBehavior(behavior) {
        this.config.enterBehavior = behavior;
    }
    isReasoningBlockCollapsed() {
        return this.config.reasoningBlockCollapsed;
    }
    setReasoningBlockCollapsed(collapsed) {
        this.config.reasoningBlockCollapsed = collapsed;
    }
    isHistoryPreviewCollapsed() {
        return this.config.historyPreviewCollapsed;
    }
    setHistoryPreviewCollapsed(collapsed) {
        this.config.historyPreviewCollapsed = collapsed;
    }
}
exports.UIService = UIService;
//# sourceMappingURL=index.js.map