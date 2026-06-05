import EventEmitter from "events";
import { SimpleGit } from "simple-git";
import { CheckpointDiff, CheckpointResult, CheckpointEventMap } from "./types";
/**
 * Environment variables stripped before passing the env to simple-git.
 *
 * Two categories:
 *  - Location-override vars (GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, GIT_OBJECT_DIRECTORY,
 *    GIT_ALTERNATE_OBJECT_DIRECTORIES, GIT_CEILING_DIRECTORIES): redirect git operations to
 *    unintended repositories or limit where git searches.
 *  - Code-execution vectors blocked by simple-git ≥3.36's blockUnsafeOperationsPlugin when
 *    passed via .env(): GIT_EDITOR, GIT_SSH_COMMAND, GIT_PAGER, PREFIX, etc.
 */
export declare const BLOCKED_ENV_KEYS: Set<string>;
/**
 * ShadowCheckpointService - Manages git-based checkpoints for task state preservation
 *
 * This service creates a "shadow" git repository that tracks changes in the workspace.
 * Each checkpoint is a git commit that can be restored to revert the workspace to that state.
 */
export declare abstract class ShadowCheckpointService extends EventEmitter {
    readonly taskId: string;
    readonly checkpointsDir: string;
    readonly workspaceDir: string;
    protected _checkpoints: string[];
    protected _baseHash?: string;
    protected readonly dotGitDir: string;
    protected git?: SimpleGit;
    protected readonly log: (message: string) => void;
    protected shadowGitConfigWorktree?: string;
    get baseHash(): string | undefined;
    protected set baseHash(value: string | undefined);
    get isInitialized(): boolean;
    getCheckpoints(): string[];
    constructor(taskId: string, checkpointsDir: string, workspaceDir: string, log: (message: string) => void);
    /**
     * Initialize the shadow git repository
     */
    initShadowGit(onInit?: () => Promise<void>): Promise<{
        created: boolean;
        duration: number;
    }>;
    /**
     * Write exclude patterns to .git/info/exclude
     */
    protected writeExcludeFile(): Promise<void>;
    /**
     * Stage all files in the workspace
     */
    private stageAll;
    /**
     * Get the core.worktree config value
     */
    private getShadowGitConfigWorktree;
    /**
     * Save a checkpoint (git commit)
     */
    saveCheckpoint(message: string, options?: {
        allowEmpty?: boolean;
        suppressMessage?: boolean;
    }): Promise<CheckpointResult | undefined>;
    /**
     * Restore to a specific checkpoint
     */
    restoreCheckpoint(commitHash: string): Promise<void>;
    /**
     * Get diff between two commits
     */
    getDiff({ from, to }: {
        from?: string;
        to?: string;
    }): Promise<CheckpointDiff[]>;
    /**
     * EventEmitter type-safe methods
     */
    emit<K extends keyof CheckpointEventMap>(event: K, data: CheckpointEventMap[K]): boolean;
    on<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void): this;
    off<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void): this;
    once<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void): this;
    /**
     * Storage helpers
     */
    static hashWorkspaceDir(workspaceDir: string): string;
    protected static taskRepoDir({ taskId, globalStorageDir }: {
        taskId: string;
        globalStorageDir: string;
    }): string;
    protected static workspaceRepoDir({ globalStorageDir, workspaceDir, }: {
        globalStorageDir: string;
        workspaceDir: string;
    }): string;
    static deleteTask({ taskId, globalStorageDir, workspaceDir, }: {
        taskId: string;
        globalStorageDir: string;
        workspaceDir: string;
    }): Promise<void>;
    static deleteBranch(git: SimpleGit, branchName: string): Promise<boolean>;
}
//# sourceMappingURL=ShadowCheckpointService.d.ts.map