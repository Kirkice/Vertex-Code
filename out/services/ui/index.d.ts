/**
 * UIService - Manages UI settings
 * Ported from Zoo-Code with VertexAI naming
 */
export interface UIConfig {
    chatFontSize: number | null;
    enterBehavior: "send" | "newline";
    reasoningBlockCollapsed: boolean;
    historyPreviewCollapsed: boolean;
}
export declare const DEFAULT_UI_CONFIG: UIConfig;
export declare class UIService {
    private config;
    constructor(config?: Partial<UIConfig>);
    getConfig(): UIConfig;
    updateConfig(updates: Partial<UIConfig>): void;
    getChatFontSize(): number | null;
    setChatFontSize(size: number | null): void;
    getEnterBehavior(): "send" | "newline";
    setEnterBehavior(behavior: "send" | "newline"): void;
    isReasoningBlockCollapsed(): boolean;
    setReasoningBlockCollapsed(collapsed: boolean): void;
    isHistoryPreviewCollapsed(): boolean;
    setHistoryPreviewCollapsed(collapsed: boolean): void;
}
//# sourceMappingURL=index.d.ts.map