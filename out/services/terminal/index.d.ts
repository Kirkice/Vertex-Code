/**
 * TerminalService - Manages terminal execution settings
 * Ported from Zoo-Code with VertexAI naming
 */
export interface TerminalConfig {
    terminalShellIntegrationTimeout: number;
    terminalShellIntegrationDisabled: boolean;
    terminalCommandDelay: number;
    terminalOutputPreviewSize: "small" | "medium" | "large";
    terminalZshClearEolMark: boolean;
    terminalZshOhMy: boolean;
    terminalZshP10k: boolean;
    terminalZdotdir: boolean;
    terminalProfile: string;
}
export declare const DEFAULT_TERMINAL_CONFIG: TerminalConfig;
export declare class TerminalService {
    private config;
    constructor(config?: Partial<TerminalConfig>);
    getConfig(): TerminalConfig;
    updateConfig(updates: Partial<TerminalConfig>): void;
    getShellIntegrationTimeout(): number;
    isShellIntegrationDisabled(): boolean;
    getCommandDelay(): number;
    getOutputPreviewSize(): "small" | "medium" | "large";
    shouldClearZshEolMark(): boolean;
    isOhMyZshEnabled(): boolean;
    isPowerlevel10kEnabled(): boolean;
    isZdotdirEnabled(): boolean;
    getTerminalProfile(): string;
}
//# sourceMappingURL=index.d.ts.map