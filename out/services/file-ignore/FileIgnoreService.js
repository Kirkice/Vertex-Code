"use strict";
/**
 * FileIgnoreService - Pattern-based file exclusion
 * Similar to .gitignore functionality
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileIgnoreService = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const types_1 = require("./types");
class FileIgnoreService {
    constructor(workspaceRoot, config = {}) {
        this.patterns = [];
        this.workspaceRoot = workspaceRoot;
        this.config = {
            ignoreFileName: config.ignoreFileName ?? ".vertexignore",
            defaultPatterns: config.defaultPatterns ?? types_1.DEFAULT_IGNORE_PATTERNS,
            respectGitignore: config.respectGitignore ?? true,
        };
    }
    /**
     * Initialize the service and load ignore patterns
     */
    async initialize() {
        await this.loadPatterns();
    }
    /**
     * Load patterns from ignore files
     */
    async loadPatterns() {
        this.patterns = [];
        // Add default patterns
        for (const pattern of this.config.defaultPatterns) {
            const compiled = this.compilePattern(pattern);
            if (compiled) {
                this.patterns.push(compiled);
            }
        }
        // Load .vertexignore
        const vertexIgnorePath = path.join(this.workspaceRoot, this.config.ignoreFileName);
        await this.loadIgnoreFile(vertexIgnorePath);
        // Load .gitignore if configured
        if (this.config.respectGitignore) {
            const gitIgnorePath = path.join(this.workspaceRoot, ".gitignore");
            await this.loadIgnoreFile(gitIgnorePath);
        }
    }
    /**
     * Load patterns from a specific ignore file
     */
    async loadIgnoreFile(filePath) {
        try {
            const content = await fs.readFile(filePath, "utf-8");
            const lines = content.split("\n");
            for (let line of lines) {
                line = line.trim();
                // Skip empty lines and comments
                if (!line || line.startsWith("#")) {
                    continue;
                }
                const compiled = this.compilePattern(line);
                if (compiled) {
                    this.patterns.push(compiled);
                }
            }
        }
        catch (error) {
            // File doesn't exist or can't be read - that's OK
        }
    }
    /**
     * Compile a gitignore-style pattern to regex
     */
    compilePattern(pattern) {
        const originalPattern = pattern;
        // Check for negation
        const negation = pattern.startsWith("!");
        if (negation) {
            pattern = pattern.slice(1);
        }
        // Check for directory-only
        const directoryOnly = pattern.endsWith("/");
        if (directoryOnly) {
            pattern = pattern.slice(0, -1);
        }
        // Convert gitignore pattern to regex
        let regexPattern = pattern
            // Escape special regex characters (except * and ?)
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            // Convert ** to match any path
            .replace(/\*\*/g, "<<<DOUBLE_STAR>>>")
            // Convert * to match anything except /
            .replace(/\*/g, "[^/]*")
            // Convert ? to match single character except /
            .replace(/\?/g, "[^/]")
            // Restore **
            .replace(/<<<DOUBLE_STAR>>>/g, ".*");
        // If pattern doesn't start with /, it can match anywhere in path
        if (!regexPattern.startsWith("/")) {
            regexPattern = "(^|.*/)" + regexPattern;
        }
        else {
            regexPattern = "^" + regexPattern.slice(1);
        }
        // Add end anchor or directory match
        if (directoryOnly) {
            regexPattern = regexPattern + "(/.*)?$";
        }
        else {
            regexPattern = regexPattern + "(/.*)?$";
        }
        try {
            const regex = new RegExp(regexPattern);
            return {
                pattern: originalPattern,
                negation,
                directoryOnly,
                regex,
            };
        }
        catch (error) {
            console.warn(`[FileIgnoreService] Invalid pattern: ${originalPattern}`);
            return null;
        }
    }
    /**
     * Check if a file path should be ignored
     */
    checkPath(filePath, isDirectory = false) {
        // Normalize path relative to workspace root
        let relativePath = filePath;
        if (path.isAbsolute(filePath)) {
            relativePath = path.relative(this.workspaceRoot, filePath);
        }
        // Normalize path separators
        relativePath = relativePath.replace(/\\/g, "/");
        // Add trailing slash for directories
        if (isDirectory && !relativePath.endsWith("/")) {
            relativePath = relativePath + "/";
        }
        // Check patterns in order (last match wins)
        let ignored = false;
        let matchedPattern;
        let negated = false;
        for (const pattern of this.patterns) {
            // Skip directory-only patterns for files
            if (pattern.directoryOnly && !isDirectory) {
                continue;
            }
            if (pattern.regex.test(relativePath)) {
                if (pattern.negation) {
                    ignored = false;
                    negated = true;
                    matchedPattern = pattern.pattern;
                }
                else {
                    ignored = true;
                    negated = false;
                    matchedPattern = pattern.pattern;
                }
            }
        }
        return {
            ignored,
            matchedPattern,
            negated,
        };
    }
    /**
     * Filter an array of file paths, returning only non-ignored paths
     */
    filterPaths(paths) {
        return paths.filter((p) => !this.checkPath(p).ignored);
    }
    /**
     * Add a pattern dynamically
     */
    addPattern(pattern) {
        const compiled = this.compilePattern(pattern);
        if (compiled) {
            this.patterns.push(compiled);
        }
    }
    /**
     * Remove a pattern
     */
    removePattern(pattern) {
        this.patterns = this.patterns.filter((p) => p.pattern !== pattern);
    }
    /**
     * Get all current patterns
     */
    getPatterns() {
        return [...this.patterns];
    }
    /**
     * Reload patterns from files
     */
    async reload() {
        await this.loadPatterns();
    }
    /**
     * Create a .vertexignore file with default patterns
     */
    async createDefaultIgnoreFile() {
        const ignorePath = path.join(this.workspaceRoot, this.config.ignoreFileName);
        const content = `# Vertex AI Ignore File
# Patterns follow .gitignore syntax

# Dependencies
node_modules/
bower_components/
vendor/

# Build outputs
dist/
build/
out/
*.o
*.obj
*.class

# IDE and editor files
.vscode/
.idea/
*.swp
*.swo
*~

# Logs and temporary files
*.log
npm-debug.log*
*.tmp
*.temp

# Cache directories
.cache/
.parcel-cache/

# Environment files
.env
.env.local
.env.*.local

# Vertex internal files
.vertex/
`;
        await fs.writeFile(ignorePath, content, "utf-8");
    }
}
exports.FileIgnoreService = FileIgnoreService;
//# sourceMappingURL=FileIgnoreService.js.map