/**
 * AutoApproveService - Manages auto-approval settings for tool execution
 * Ported from Zoo-Code with VertexAI naming
 */
export interface AutoApproveConfig {
    alwaysAllowReadOnly: boolean;
    alwaysAllowReadOnlyOutsideWorkspace: boolean;
    alwaysAllowWrite: boolean;
    alwaysAllowWriteOutsideWorkspace: boolean;
    alwaysAllowWriteProtected: boolean;
    alwaysAllowExecute: boolean;
    allowedCommands: string[];
    deniedCommands: string[];
    alwaysAllowMcp: boolean;
    alwaysAllowModeSwitch: boolean;
    alwaysAllowSubtasks: boolean;
    alwaysAllowFollowupQuestions: boolean;
    followupAutoApproveTimeoutMs?: number;
    allowedMaxRequests?: number;
    allowedMaxCost?: number;
}
export declare const DEFAULT_AUTO_APPROVE_CONFIG: AutoApproveConfig;
export declare class AutoApproveService {
    private config;
    constructor(config?: Partial<AutoApproveConfig>);
    getConfig(): AutoApproveConfig;
    updateConfig(updates: Partial<AutoApproveConfig>): void;
    isCommandAllowed(command: string): boolean;
    shouldAutoApproveRead(outsideWorkspace?: boolean): boolean;
    shouldAutoApproveWrite(outsideWorkspace?: boolean, isProtected?: boolean): boolean;
    shouldAutoApproveExecute(command: string): boolean;
    shouldAutoApproveMcp(): boolean;
    shouldAutoApproveModeSwitch(): boolean;
    shouldAutoApproveSubtask(): boolean;
    shouldAutoApproveFollowup(): boolean;
    getFollowupTimeout(): number | undefined;
    isMaxRequestsReached(currentRequests: number): boolean;
    isMaxCostReached(currentCost: number): boolean;
}
//# sourceMappingURL=index.d.ts.map