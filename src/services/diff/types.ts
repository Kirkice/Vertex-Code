/**
 * Diff Service Types
 * Defines the search/replace block format for file editing
 */

export interface DiffBlock {
	/** The exact content to search for in the file */
	search: string
	/** The content to replace the search with */
	replace: string
}

export interface DiffResult {
	/** Whether the diff was applied successfully */
	success: boolean
	/** The file path that was modified */
	filePath: string
	/** Original content before changes */
	originalContent: string
	/** Content after applying changes */
	newContent: string
	/** Number of blocks successfully applied */
	blocksApplied: number
	/** Total number of blocks in the diff */
	totalBlocks: number
	/** Error messages for failed blocks */
	errors: DiffError[]
}

export interface DiffError {
	/** Block index that failed */
	blockIndex: number
	/** Error description */
	message: string
	/** The search content that wasn't found */
	searchContent: string
}

export interface ApplyDiffOptions {
	/** If true, apply all blocks even if some fail */
	applyAll: boolean
	/** If true, create the file if it doesn't exist */
	createIfNotExists: boolean
}

export const DEFAULT_DIFF_OPTIONS: ApplyDiffOptions = {
	applyAll: true,
	createIfNotExists: false,
}