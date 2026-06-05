"use strict";
/**
 * DiffApplier - Applies parsed diff blocks to file content
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffApplier = exports.DiffApplier = void 0;
const types_1 = require("./types");
class DiffApplier {
    /**
     * Apply a single diff block to content
     */
    applyBlock(content, block) {
        const searchIndex = content.indexOf(block.search);
        if (searchIndex === -1) {
            return {
                success: false,
                result: content,
                error: "Search content not found in file",
            };
        }
        // Check for multiple occurrences
        const secondIndex = content.indexOf(block.search, searchIndex + 1);
        if (secondIndex !== -1) {
            return {
                success: false,
                result: content,
                error: "Search content found multiple times - must be unique",
            };
        }
        // Apply the replacement
        const before = content.slice(0, searchIndex);
        const after = content.slice(searchIndex + block.search.length);
        const result = before + block.replace + after;
        return {
            success: true,
            result,
        };
    }
    /**
     * Apply multiple diff blocks to content sequentially
     */
    applyBlocks(content, blocks, options = {}) {
        const opts = { ...types_1.DEFAULT_DIFF_OPTIONS, ...options };
        let currentContent = content;
        let applied = 0;
        const errors = [];
        for (let i = 0; i < blocks.length; i++) {
            const result = this.applyBlock(currentContent, blocks[i]);
            if (result.success) {
                currentContent = result.result;
                applied++;
            }
            else {
                errors.push({
                    blockIndex: i,
                    message: result.error || "Unknown error",
                    searchContent: blocks[i].search,
                });
                if (!opts.applyAll) {
                    break;
                }
            }
        }
        return { content: currentContent, applied, errors };
    }
    /**
     * Apply diff blocks and return a complete result
     */
    apply(filePath, originalContent, blocks, options = {}) {
        const { content, applied, errors } = this.applyBlocks(originalContent, blocks, options);
        return {
            success: errors.length === 0,
            filePath,
            originalContent,
            newContent: content,
            blocksApplied: applied,
            totalBlocks: blocks.length,
            errors,
        };
    }
}
exports.DiffApplier = DiffApplier;
exports.diffApplier = new DiffApplier();
//# sourceMappingURL=DiffApplier.js.map