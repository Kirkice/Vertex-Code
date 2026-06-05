/**
 * ContextManagementService - Manages context window and compression settings
 * Ported from Zoo-Code with VertexAI naming
 */
export interface ContextManagementConfig {
    autoCondenseContext: boolean;
    autoCondenseContextPercent: number;
    maxOpenTabsContext: number;
    maxWorkspaceFiles: number;
    showVertexIgnoredFiles: boolean;
    enableSubfolderRules: boolean;
    maxImageFileSize: number;
    maxTotalImageSize: number;
    profileThresholds: Record<string, number>;
    includeDiagnosticMessages: boolean;
    maxDiagnosticMessages: number;
    writeDelayMs: number;
    includeCurrentTime: boolean;
    includeCurrentCost: boolean;
    maxGitStatusFiles: number;
    customSupportPrompts: Record<string, string>;
}
export declare const DEFAULT_CONTEXT_MANAGEMENT_CONFIG: ContextManagementConfig;
export declare class ContextManagementService {
    private config;
    constructor(config?: Partial<ContextManagementConfig>);
    getConfig(): ContextManagementConfig;
    updateConfig(updates: Partial<ContextManagementConfig>): void;
    isAutoCondenseEnabled(): boolean;
    getAutoCondensePercent(): number;
    getMaxOpenTabsContext(): number;
    getMaxWorkspaceFiles(): number;
    shouldShowIgnoredFiles(): boolean;
    areSubfolderRulesEnabled(): boolean;
    getMaxImageFileSize(): number;
    getMaxTotalImageSize(): number;
    getProfileThresholds(): Record<string, number>;
    setProfileThreshold(profileId: string, threshold: number): void;
    shouldIncludeDiagnostics(): boolean;
    getMaxDiagnostics(): number;
    getWriteDelay(): number;
    shouldIncludeCurrentTime(): boolean;
    shouldIncludeCurrentCost(): boolean;
    getMaxGitStatusFiles(): number;
    getCustomSupportPrompts(): Record<string, string>;
    setCustomSupportPrompt(key: string, prompt: string): void;
}
//# sourceMappingURL=index.d.ts.map