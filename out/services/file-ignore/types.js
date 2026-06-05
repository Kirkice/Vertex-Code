"use strict";
/**
 * File Ignore Service Types
 * Pattern-based file exclusion (similar to .gitignore)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_IGNORE_PATTERNS = void 0;
exports.DEFAULT_IGNORE_PATTERNS = [
    // Version control
    ".git/",
    ".svn/",
    ".hg/",
    // Dependencies
    "node_modules/",
    "bower_components/",
    "vendor/",
    // Build outputs
    "dist/",
    "build/",
    "out/",
    "*.o",
    "*.obj",
    "*.class",
    "*.jar",
    "*.war",
    // IDE and editor files
    ".vscode/",
    ".idea/",
    "*.swp",
    "*.swo",
    "*~",
    ".DS_Store",
    "Thumbs.db",
    // Logs and temporary files
    "*.log",
    "npm-debug.log*",
    "yarn-debug.log*",
    "yarn-error.log*",
    "*.tmp",
    "*.temp",
    // Cache directories
    ".cache/",
    ".parcel-cache/",
    ".next/",
    ".nuxt/",
    // Environment files
    ".env",
    ".env.local",
    ".env.*.local",
    // Coverage and test outputs
    "coverage/",
    ".nyc_output/",
    ".pytest_cache/",
    // Vertex internal files
    ".vertex/",
];
//# sourceMappingURL=types.js.map