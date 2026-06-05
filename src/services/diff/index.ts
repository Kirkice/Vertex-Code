/**
 * Diff Service - File editing via SEARCH/REPLACE blocks
 */

export * from "./types"
export { DiffParser, diffParser } from "./DiffParser"
export { DiffApplier, diffApplier } from "./DiffApplier"

/**
 * Convenience function to apply a diff to file content
 */
export function applyDiff(filePath: string, originalContent: string, diffText: string) {
	const { diffParser } = require("./DiffParser")
	const { diffApplier } = require("./DiffApplier")

	const { blocks, errors: parseErrors } = diffParser.parseWithValidation(diffText)

	if (parseErrors.length > 0) {
		return {
			success: false,
			filePath,
			originalContent,
			newContent: originalContent,
			blocksApplied: 0,
			totalBlocks: 0,
			errors: parseErrors.map((msg: string, i: number) => ({
				blockIndex: i,
				message: msg,
				searchContent: "",
			})),
		}
	}

	return diffApplier.apply(filePath, originalContent, blocks)
}