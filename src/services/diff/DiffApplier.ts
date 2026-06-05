/**
 * DiffApplier - Applies parsed diff blocks to file content
 */

import type { DiffBlock, DiffResult, DiffError, ApplyDiffOptions } from "./types"
import { DEFAULT_DIFF_OPTIONS } from "./types"

export class DiffApplier {
	/**
	 * Apply a single diff block to content
	 */
	applyBlock(content: string, block: DiffBlock): { success: boolean; result: string; error?: string } {
		const searchIndex = content.indexOf(block.search)

		if (searchIndex === -1) {
			return {
				success: false,
				result: content,
				error: "Search content not found in file",
			}
		}

		// Check for multiple occurrences
		const secondIndex = content.indexOf(block.search, searchIndex + 1)
		if (secondIndex !== -1) {
			return {
				success: false,
				result: content,
				error: "Search content found multiple times - must be unique",
			}
		}

		// Apply the replacement
		const before = content.slice(0, searchIndex)
		const after = content.slice(searchIndex + block.search.length)
		const result = before + block.replace + after

		return {
			success: true,
			result,
		}
	}

	/**
	 * Apply multiple diff blocks to content sequentially
	 */
	applyBlocks(
		content: string,
		blocks: DiffBlock[],
		options: Partial<ApplyDiffOptions> = {},
	): { content: string; applied: number; errors: DiffError[] } {
		const opts = { ...DEFAULT_DIFF_OPTIONS, ...options }
		let currentContent = content
		let applied = 0
		const errors: DiffError[] = []

		for (let i = 0; i < blocks.length; i++) {
			const result = this.applyBlock(currentContent, blocks[i])

			if (result.success) {
				currentContent = result.result
				applied++
			} else {
				errors.push({
					blockIndex: i,
					message: result.error || "Unknown error",
					searchContent: blocks[i].search,
				})

				if (!opts.applyAll) {
					break
				}
			}
		}

		return { content: currentContent, applied, errors }
	}

	/**
	 * Apply diff blocks and return a complete result
	 */
	apply(
		filePath: string,
		originalContent: string,
		blocks: DiffBlock[],
		options: Partial<ApplyDiffOptions> = {},
	): DiffResult {
		const { content, applied, errors } = this.applyBlocks(originalContent, blocks, options)

		return {
			success: errors.length === 0,
			filePath,
			originalContent,
			newContent: content,
			blocksApplied: applied,
			totalBlocks: blocks.length,
			errors,
		}
	}
}

export const diffApplier = new DiffApplier()