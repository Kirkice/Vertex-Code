/**
 * FileIgnoreService - Pattern-based file exclusion
 * Similar to .gitignore functionality
 */

import * as fs from "fs/promises"
import * as path from "path"
import type { IgnorePattern, FileIgnoreConfig, FileCheckResult } from "./types"
import { DEFAULT_IGNORE_PATTERNS } from "./types"

export class FileIgnoreService {
	private patterns: IgnorePattern[] = []
	private config: Required<FileIgnoreConfig>
	private workspaceRoot: string

	constructor(workspaceRoot: string, config: FileIgnoreConfig = {}) {
		this.workspaceRoot = workspaceRoot
		this.config = {
			ignoreFileName: config.ignoreFileName ?? ".vertexignore",
			defaultPatterns: config.defaultPatterns ?? DEFAULT_IGNORE_PATTERNS,
			respectGitignore: config.respectGitignore ?? true,
		}
	}

	/**
	 * Initialize the service and load ignore patterns
	 */
	async initialize(): Promise<void> {
		await this.loadPatterns()
	}

	/**
	 * Load patterns from ignore files
	 */
	private async loadPatterns(): Promise<void> {
		this.patterns = []

		// Add default patterns
		for (const pattern of this.config.defaultPatterns) {
			const compiled = this.compilePattern(pattern)
			if (compiled) {
				this.patterns.push(compiled)
			}
		}

		// Load .vertexignore
		const vertexIgnorePath = path.join(this.workspaceRoot, this.config.ignoreFileName)
		await this.loadIgnoreFile(vertexIgnorePath)

		// Load .gitignore if configured
		if (this.config.respectGitignore) {
			const gitIgnorePath = path.join(this.workspaceRoot, ".gitignore")
			await this.loadIgnoreFile(gitIgnorePath)
		}
	}

	/**
	 * Load patterns from a specific ignore file
	 */
	private async loadIgnoreFile(filePath: string): Promise<void> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const lines = content.split("\n")

			for (let line of lines) {
				line = line.trim()

				// Skip empty lines and comments
				if (!line || line.startsWith("#")) {
					continue
				}

				const compiled = this.compilePattern(line)
				if (compiled) {
					this.patterns.push(compiled)
				}
			}
		} catch (error) {
			// File doesn't exist or can't be read - that's OK
		}
	}

	/**
	 * Compile a gitignore-style pattern to regex
	 */
	private compilePattern(pattern: string): IgnorePattern | null {
		const originalPattern = pattern

		// Check for negation
		const negation = pattern.startsWith("!")
		if (negation) {
			pattern = pattern.slice(1)
		}

		// Check for directory-only
		const directoryOnly = pattern.endsWith("/")
		if (directoryOnly) {
			pattern = pattern.slice(0, -1)
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
			.replace(/<<<DOUBLE_STAR>>>/g, ".*")

		// If pattern doesn't start with /, it can match anywhere in path
		if (!regexPattern.startsWith("/")) {
			regexPattern = "(^|.*/)" + regexPattern
		} else {
			regexPattern = "^" + regexPattern.slice(1)
		}

		// Add end anchor or directory match
		if (directoryOnly) {
			regexPattern = regexPattern + "(/.*)?$"
		} else {
			regexPattern = regexPattern + "(/.*)?$"
		}

		try {
			const regex = new RegExp(regexPattern)
			return {
				pattern: originalPattern,
				negation,
				directoryOnly,
				regex,
			}
		} catch (error) {
			console.warn(`[FileIgnoreService] Invalid pattern: ${originalPattern}`)
			return null
		}
	}

	/**
	 * Check if a file path should be ignored
	 */
	checkPath(filePath: string, isDirectory: boolean = false): FileCheckResult {
		// Normalize path relative to workspace root
		let relativePath = filePath
		if (path.isAbsolute(filePath)) {
			relativePath = path.relative(this.workspaceRoot, filePath)
		}

		// Normalize path separators
		relativePath = relativePath.replace(/\\/g, "/")

		// Add trailing slash for directories
		if (isDirectory && !relativePath.endsWith("/")) {
			relativePath = relativePath + "/"
		}

		// Check patterns in order (last match wins)
		let ignored = false
		let matchedPattern: string | undefined
		let negated = false

		for (const pattern of this.patterns) {
			// Skip directory-only patterns for files
			if (pattern.directoryOnly && !isDirectory) {
				continue
			}

			if (pattern.regex.test(relativePath)) {
				if (pattern.negation) {
					ignored = false
					negated = true
					matchedPattern = pattern.pattern
				} else {
					ignored = true
					negated = false
					matchedPattern = pattern.pattern
				}
			}
		}

		return {
			ignored,
			matchedPattern,
			negated,
		}
	}

	/**
	 * Filter an array of file paths, returning only non-ignored paths
	 */
	filterPaths(paths: string[]): string[] {
		return paths.filter((p) => !this.checkPath(p).ignored)
	}

	/**
	 * Add a pattern dynamically
	 */
	addPattern(pattern: string): void {
		const compiled = this.compilePattern(pattern)
		if (compiled) {
			this.patterns.push(compiled)
		}
	}

	/**
	 * Remove a pattern
	 */
	removePattern(pattern: string): void {
		this.patterns = this.patterns.filter((p) => p.pattern !== pattern)
	}

	/**
	 * Get all current patterns
	 */
	getPatterns(): IgnorePattern[] {
		return [...this.patterns]
	}

	/**
	 * Reload patterns from files
	 */
	async reload(): Promise<void> {
		await this.loadPatterns()
	}

	/**
	 * Create a .vertexignore file with default patterns
	 */
	async createDefaultIgnoreFile(): Promise<void> {
		const ignorePath = path.join(this.workspaceRoot, this.config.ignoreFileName)

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
`

		await fs.writeFile(ignorePath, content, "utf-8")
	}
}