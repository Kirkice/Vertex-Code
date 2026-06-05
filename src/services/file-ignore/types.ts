/**
 * File Ignore Service Types
 * Pattern-based file exclusion (similar to .gitignore)
 */

export interface IgnorePattern {
	/** The raw pattern string */
	pattern: string
	/** Whether this is a negation pattern (starts with !) */
	negation: boolean
	/** Whether this pattern matches directories only (ends with /) */
	directoryOnly: boolean
	/** The compiled regex for matching */
	regex: RegExp
}

export interface FileIgnoreConfig {
	/** Name of the ignore file (default: .vertexignore) */
	ignoreFileName?: string
	/** Additional patterns to always ignore */
	defaultPatterns?: string[]
	/** Whether to respect .gitignore files */
	respectGitignore?: boolean
}

export interface FileCheckResult {
	/** Whether the file is ignored */
	ignored: boolean
	/** The pattern that caused the ignore (if any) */
	matchedPattern?: string
	/** Whether this was a negation (explicitly included) */
	negated?: boolean
}

export const DEFAULT_IGNORE_PATTERNS = [
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
]