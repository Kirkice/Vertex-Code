"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShadowCheckpointService = exports.BLOCKED_ENV_KEYS = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const os_1 = __importDefault(require("os"));
const path = __importStar(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const events_1 = __importDefault(require("events"));
const simple_git_1 = __importDefault(require("simple-git"));
const excludes_1 = require("./excludes");
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
exports.BLOCKED_ENV_KEYS = new Set([
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_CEILING_DIRECTORIES",
    "GIT_TEMPLATE_DIR",
    "GIT_EDITOR",
    "GIT_SEQUENCE_EDITOR",
    "GIT_ASKPASS",
    "GIT_SSH",
    "GIT_SSH_COMMAND",
    "GIT_PAGER",
    "GIT_PROXY_COMMAND",
    "GIT_EXEC_PATH",
    "GIT_EXTERNAL_DIFF",
    "GIT_CONFIG",
    "GIT_CONFIG_GLOBAL",
    "GIT_CONFIG_SYSTEM",
    "GIT_CONFIG_COUNT",
    "PREFIX",
    "EDITOR",
    "PAGER",
    "SSH_ASKPASS",
]);
// Lowercase set for case-insensitive lookup
const BLOCKED_ENV_KEYS_LOWER = new Set([...exports.BLOCKED_ENV_KEYS].map((k) => k.toLowerCase()));
/**
 * Check if a path exists
 */
const fileExistsAtPath = async (filePath) => {
    try {
        await promises_1.default.access(filePath);
        return true;
    }
    catch {
        return false;
    }
};
/**
 * Compare two paths for equality, handling Windows case-insensitivity
 */
const arePathsEqual = (path1, path2) => {
    if (process.platform === "win32") {
        return path1.toLowerCase() === path2.toLowerCase();
    }
    return path1 === path2;
};
/**
 * Creates a SimpleGit instance with sanitized environment variables to prevent
 * interference from inherited git environment variables like GIT_DIR and GIT_WORK_TREE.
 */
function createSanitizedGit(baseDir) {
    const sanitizedEnv = {};
    const removedKeys = [];
    for (const [key, value] of Object.entries(process.env)) {
        if (BLOCKED_ENV_KEYS_LOWER.has(key.toLowerCase())) {
            removedKeys.push(key);
            continue;
        }
        if (value !== undefined) {
            sanitizedEnv[key] = value;
        }
    }
    if (removedKeys.length > 0) {
        console.log(`[createSanitizedGit] Removed git environment variables for checkpoint isolation: ${removedKeys.join(", ")}`);
    }
    const options = {
        baseDir,
        config: [],
        unsafe: { allowUnsafeTemplateDir: true },
    };
    const git = (0, simple_git_1.default)(options);
    git.env(sanitizedEnv);
    console.log(`[createSanitizedGit] Created git instance for baseDir: ${baseDir}`);
    return git;
}
/**
 * ShadowCheckpointService - Manages git-based checkpoints for task state preservation
 *
 * This service creates a "shadow" git repository that tracks changes in the workspace.
 * Each checkpoint is a git commit that can be restored to revert the workspace to that state.
 */
class ShadowCheckpointService extends events_1.default {
    get baseHash() {
        return this._baseHash;
    }
    set baseHash(value) {
        this._baseHash = value;
    }
    get isInitialized() {
        return !!this.git;
    }
    getCheckpoints() {
        return this._checkpoints.slice();
    }
    constructor(taskId, checkpointsDir, workspaceDir, log) {
        super();
        this._checkpoints = [];
        const homedir = os_1.default.homedir();
        const desktopPath = path.join(homedir, "Desktop");
        const documentsPath = path.join(homedir, "Documents");
        const downloadsPath = path.join(homedir, "Downloads");
        const protectedPaths = [homedir, desktopPath, documentsPath, downloadsPath];
        if (protectedPaths.includes(workspaceDir)) {
            throw new Error(`Cannot use checkpoints in ${workspaceDir}`);
        }
        this.taskId = taskId;
        this.checkpointsDir = checkpointsDir;
        this.workspaceDir = workspaceDir;
        this.dotGitDir = path.join(this.checkpointsDir, ".git");
        this.log = log;
    }
    /**
     * Initialize the shadow git repository
     */
    async initShadowGit(onInit) {
        if (this.git) {
            throw new Error("Shadow git repo already initialized");
        }
        await promises_1.default.mkdir(this.checkpointsDir, { recursive: true });
        const git = createSanitizedGit(this.checkpointsDir);
        const gitVersion = await git.version();
        this.log(`[${this.constructor.name}#create] git = ${gitVersion}`);
        let created = false;
        const startTime = Date.now();
        if (await fileExistsAtPath(this.dotGitDir)) {
            this.log(`[${this.constructor.name}#initShadowGit] shadow git repo already exists at ${this.dotGitDir}`);
            const worktree = await this.getShadowGitConfigWorktree(git);
            if (!worktree) {
                throw new Error("Checkpoints require core.worktree to be set in the shadow git config");
            }
            const worktreeTrimmed = worktree.trim();
            if (!arePathsEqual(worktreeTrimmed, this.workspaceDir)) {
                throw new Error(`Checkpoints can only be used in the original workspace: ${worktreeTrimmed} !== ${this.workspaceDir}`);
            }
            await this.writeExcludeFile();
            this.baseHash = await git.revparse(["HEAD"]);
        }
        else {
            this.log(`[${this.constructor.name}#initShadowGit] creating shadow git repo at ${this.checkpointsDir}`);
            await git.init({ "--template": "" });
            await git.addConfig("core.worktree", this.workspaceDir);
            await git.addConfig("commit.gpgSign", "false");
            await git.addConfig("user.name", "Vertex AI");
            await git.addConfig("user.email", "noreply@example.com");
            await this.writeExcludeFile();
            await this.stageAll(git);
            const { commit } = await git.commit("initial commit", { "--allow-empty": null });
            this.baseHash = commit;
            created = true;
        }
        const duration = Date.now() - startTime;
        this.log(`[${this.constructor.name}#initShadowGit] initialized shadow repo with base commit ${this.baseHash} in ${duration}ms`);
        this.git = git;
        await onInit?.();
        this.emit("initialize", {
            type: "initialize",
            workspaceDir: this.workspaceDir,
            baseHash: this.baseHash,
            created,
            duration,
        });
        return { created, duration };
    }
    /**
     * Write exclude patterns to .git/info/exclude
     */
    async writeExcludeFile() {
        await promises_1.default.mkdir(path.join(this.dotGitDir, "info"), { recursive: true });
        const patterns = await (0, excludes_1.getExcludePatterns)(this.workspaceDir);
        await promises_1.default.writeFile(path.join(this.dotGitDir, "info", "exclude"), patterns.join("\n"));
    }
    /**
     * Stage all files in the workspace
     */
    async stageAll(git) {
        try {
            await git.add([".", "--ignore-errors"]);
        }
        catch (error) {
            this.log(`[${this.constructor.name}#stageAll] failed to add files to git: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get the core.worktree config value
     */
    async getShadowGitConfigWorktree(git) {
        if (!this.shadowGitConfigWorktree) {
            try {
                this.shadowGitConfigWorktree = (await git.getConfig("core.worktree")).value || undefined;
            }
            catch (error) {
                this.log(`[${this.constructor.name}#getShadowGitConfigWorktree] failed to get core.worktree: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return this.shadowGitConfigWorktree;
    }
    /**
     * Save a checkpoint (git commit)
     */
    async saveCheckpoint(message, options) {
        try {
            this.log(`[${this.constructor.name}#saveCheckpoint] starting checkpoint save (allowEmpty: ${options?.allowEmpty ?? false})`);
            if (!this.git) {
                throw new Error("Shadow git repo not initialized");
            }
            const startTime = Date.now();
            await this.stageAll(this.git);
            const commitArgs = options?.allowEmpty ? { "--allow-empty": null } : undefined;
            const result = await this.git.commit(message, commitArgs);
            const fromHash = this._checkpoints[this._checkpoints.length - 1] ?? this.baseHash;
            const toHash = result.commit || fromHash;
            this._checkpoints.push(toHash);
            const duration = Date.now() - startTime;
            if (result.commit) {
                this.emit("checkpoint", {
                    type: "checkpoint",
                    fromHash,
                    toHash,
                    duration,
                    suppressMessage: options?.suppressMessage ?? false,
                });
            }
            if (result.commit) {
                this.log(`[${this.constructor.name}#saveCheckpoint] checkpoint saved in ${duration}ms -> ${result.commit}`);
                return result;
            }
            else {
                this.log(`[${this.constructor.name}#saveCheckpoint] found no changes to commit in ${duration}ms`);
                return undefined;
            }
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this.log(`[${this.constructor.name}#saveCheckpoint] failed to create checkpoint: ${error.message}`);
            this.emit("error", { type: "error", error });
            throw error;
        }
    }
    /**
     * Restore to a specific checkpoint
     */
    async restoreCheckpoint(commitHash) {
        try {
            this.log(`[${this.constructor.name}#restoreCheckpoint] starting checkpoint restore`);
            if (!this.git) {
                throw new Error("Shadow git repo not initialized");
            }
            const start = Date.now();
            await this.git.clean("f", ["-d", "-f"]);
            await this.git.reset(["--hard", commitHash]);
            // Remove all checkpoints after the specified commitHash
            const checkpointIndex = this._checkpoints.indexOf(commitHash);
            if (checkpointIndex !== -1) {
                this._checkpoints = this._checkpoints.slice(0, checkpointIndex + 1);
            }
            const duration = Date.now() - start;
            this.emit("restore", { type: "restore", commitHash, duration });
            this.log(`[${this.constructor.name}#restoreCheckpoint] restored checkpoint ${commitHash} in ${duration}ms`);
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this.log(`[${this.constructor.name}#restoreCheckpoint] failed to restore checkpoint: ${error.message}`);
            this.emit("error", { type: "error", error });
            throw error;
        }
    }
    /**
     * Get diff between two commits
     */
    async getDiff({ from, to }) {
        if (!this.git) {
            throw new Error("Shadow git repo not initialized");
        }
        const result = [];
        if (!from) {
            from = (await this.git.raw(["rev-list", "--max-parents=0", "HEAD"])).trim();
        }
        // Stage all changes so that untracked files appear in diff summary
        await this.stageAll(this.git);
        this.log(`[${this.constructor.name}#getDiff] diffing ${to ? `${from}..${to}` : `${from}..HEAD`}`);
        const { files } = to ? await this.git.diffSummary([`${from}..${to}`]) : await this.git.diffSummary([from]);
        const cwdPath = (await this.getShadowGitConfigWorktree(this.git)) || this.workspaceDir || "";
        for (const file of files) {
            const relPath = file.file;
            const absPath = path.join(cwdPath, relPath);
            const before = await this.git.show([`${from}:${relPath}`]).catch(() => "");
            const after = to
                ? await this.git.show([`${to}:${relPath}`]).catch(() => "")
                : await promises_1.default.readFile(absPath, "utf8").catch(() => "");
            result.push({ paths: { relative: relPath, absolute: absPath }, content: { before, after } });
        }
        return result;
    }
    /**
     * EventEmitter type-safe methods
     */
    emit(event, data) {
        return super.emit(event, data);
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    off(event, listener) {
        return super.off(event, listener);
    }
    once(event, listener) {
        return super.once(event, listener);
    }
    /**
     * Storage helpers
     */
    static hashWorkspaceDir(workspaceDir) {
        return crypto_1.default.createHash("sha256").update(workspaceDir).digest("hex").toString().slice(0, 8);
    }
    static taskRepoDir({ taskId, globalStorageDir }) {
        return path.join(globalStorageDir, "tasks", taskId, "checkpoints");
    }
    static workspaceRepoDir({ globalStorageDir, workspaceDir, }) {
        return path.join(globalStorageDir, "checkpoints", this.hashWorkspaceDir(workspaceDir));
    }
    static async deleteTask({ taskId, globalStorageDir, workspaceDir, }) {
        const workspaceRepoDir = this.workspaceRepoDir({ globalStorageDir, workspaceDir });
        const branchName = `vertex-${taskId}`;
        const git = createSanitizedGit(workspaceRepoDir);
        const success = await this.deleteBranch(git, branchName);
        if (success) {
            console.log(`[${this.name}#deleteTask.${taskId}] deleted branch ${branchName}`);
        }
        else {
            console.error(`[${this.name}#deleteTask.${taskId}] failed to delete branch ${branchName}`);
        }
    }
    static async deleteBranch(git, branchName) {
        const branches = await git.branchLocal();
        if (!branches.all.includes(branchName)) {
            console.error(`[${this.constructor.name}#deleteBranch] branch ${branchName} does not exist`);
            return false;
        }
        const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);
        if (currentBranch === branchName) {
            const worktree = await git.getConfig("core.worktree");
            try {
                await git.raw(["config", "--unset", "core.worktree"]);
                await git.reset(["--hard"]);
                await git.clean("f", ["-d"]);
                const defaultBranch = branches.all.includes("main") ? "main" : "master";
                await git.checkout([defaultBranch, "--force"]);
                // Wait for branch switch
                await new Promise((resolve, reject) => {
                    let attempts = 0;
                    const check = async () => {
                        try {
                            const newBranch = await git.revparse(["--abbrev-ref", "HEAD"]);
                            if (newBranch === defaultBranch) {
                                resolve();
                            }
                            else if (attempts++ > 4) {
                                reject(new Error("Timeout waiting for branch switch"));
                            }
                            else {
                                setTimeout(check, 500);
                            }
                        }
                        catch (e) {
                            reject(e);
                        }
                    };
                    check();
                });
                await git.branch(["-D", branchName]);
                return true;
            }
            catch (error) {
                console.error(`[${this.constructor.name}#deleteBranch] failed to delete branch ${branchName}: ${error instanceof Error ? error.message : String(error)}`);
                return false;
            }
            finally {
                if (worktree.value) {
                    await git.addConfig("core.worktree", worktree.value);
                }
            }
        }
        else {
            await git.branch(["-D", branchName]);
            return true;
        }
    }
}
exports.ShadowCheckpointService = ShadowCheckpointService;
//# sourceMappingURL=ShadowCheckpointService.js.map