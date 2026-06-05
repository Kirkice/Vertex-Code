/**
 * FileIgnoreService - Pattern-based file exclusion
 * Similar to .gitignore functionality
 */
import type { IgnorePattern, FileIgnoreConfig, FileCheckResult } from "./types";
export declare class FileIgnoreService {
    private patterns;
    private config;
    private workspaceRoot;
    constructor(workspaceRoot: string, config?: FileIgnoreConfig);
    /**
     * Initialize the service and load ignore patterns
     */
    initialize(): Promise<void>;
    /**
     * Load patterns from ignore files
     */
    private loadPatterns;
    /**
     * Load patterns from a specific ignore file
     */
    private loadIgnoreFile;
    /**
     * Compile a gitignore-style pattern to regex
     */
    private compilePattern;
    /**
     * Check if a file path should be ignored
     */
    checkPath(filePath: string, isDirectory?: boolean): FileCheckResult;
    /**
     * Filter an array of file paths, returning only non-ignored paths
     */
    filterPaths(paths: string[]): string[];
    /**
     * Add a pattern dynamically
     */
    addPattern(pattern: string): void;
    /**
     * Remove a pattern
     */
    removePattern(pattern: string): void;
    /**
     * Get all current patterns
     */
    getPatterns(): IgnorePattern[];
    /**
     * Reload patterns from files
     */
    reload(): Promise<void>;
    /**
     * Create a .vertexignore file with default patterns
     */
    createDefaultIgnoreFile(): Promise<void>;
}
//# sourceMappingURL=FileIgnoreService.d.ts.map