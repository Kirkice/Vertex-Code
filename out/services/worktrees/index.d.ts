/**
 * WorktreesService - Manages Git worktree settings
 * Ported from Zoo-Code with VertexAI naming
 */
export interface WorktreesConfig {
    showWorktreesInHomeScreen: boolean;
}
export declare const DEFAULT_WORKTREES_CONFIG: WorktreesConfig;
export declare class WorktreesService {
    private config;
    constructor(config?: Partial<WorktreesConfig>);
    getConfig(): WorktreesConfig;
    updateConfig(updates: Partial<WorktreesConfig>): void;
    shouldShowInHomeScreen(): boolean;
}
//# sourceMappingURL=index.d.ts.map