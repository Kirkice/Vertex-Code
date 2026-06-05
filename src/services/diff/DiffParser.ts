/**
 * DiffParser - Parses SEARCH/REPLACE blocks from LLM output
 * 
 * Format:
 * ------- SEARCH
 * content to find
 * =======
 * content to replace with
 * +++++++ REPLACE
 */

import type { DiffBlock } from "./types"

// Markers for search/replace blocks
const SEARCH_START_MARKER = "------- SEARCH"
const SEARCH_END_MARKER = "======="
const REPLACE_END_MARKER = "+++++++ REPLACE"

export class DiffParser {
	/**
	 * Parse diff text into blocks
	 */
	parse(diffText: string): DiffBlock[] {
		const blocks: DiffBlock[] = []
		const lines = diffText.split("\n")
		let currentIndex = 0

		while (currentIndex < lines.length) {
			// Look for SEARCH start marker
			if (lines[currentIndex].trim() === SEARCH_START_MARKER) {
				const blockStart = currentIndex + 1
				
				// Find SEARCH end marker
				let searchEndIndex = -1
				for (let i = blockStart; i < lines.length; i++) {
					if (lines[i].trim() === SEARCH_END_MARKER) {
						searchEndIndex = i
						break
					}
				}

				if (searchEndIndex === -1) {
					// No end marker found, skip this block
					currentIndex++
					continue
				}

				// Find REPLACE end marker
				let replaceEndIndex = -1
				for (let i = searchEndIndex + 1; i < lines.length; i++) {
					if (lines[i].trim() === REPLACE_END_MARKER) {
						replaceEndIndex = i
						break
					}
				}

				if (replaceEndIndex === -1) {
					// No replace end marker found, skip this block
					currentIndex++
					continue
				}

				// Extract search and replace content
				const searchContent = lines.slice(blockStart, searchEndIndex).join("\n")
				const replaceContent = lines.slice(searchEndIndex + 1, replaceEndIndex).join("\n")

				blocks.push({
					search: searchContent,
					replace: replaceContent,
				})

				currentIndex = replaceEndIndex + 1
			} else {
				currentIndex++
			}
		}

		return blocks
	}

	/**
	 * Validate that a diff block has valid format
	 */
	validateBlock(block: DiffBlock): { valid: boolean; error?: string } {
		if (block.search === undefined || block.search === null) {
			return { valid: false, error: "Search content is missing" }
		}

		if (block.replace === undefined || block.replace === null) {
			return { valid: false, error: "Replace content is missing" }
		}

		return { valid: true }
	}

	/**
	 * Parse and validate diff text, returning blocks and errors
	 */
	parseWithValidation(diffText: string): { blocks: DiffBlock[]; errors: string[] } {
		const blocks = this.parse(diffText)
		const errors: string[] = []

		for (let i = 0; i < blocks.length; i++) {
			const validation = this.validateBlock(blocks[i])
			if (!validation.valid) {
				errors.push(`Block ${i + 1}: ${validation.error}`)
			}
		}

		return { blocks, errors }
	}
}

export const diffParser = new DiffParser()