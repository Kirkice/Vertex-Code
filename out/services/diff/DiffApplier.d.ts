/**
 * DiffApplier - Applies parsed diff blocks to file content
 */
import type { DiffBlock, DiffResult, DiffError, ApplyDiffOptions } from "./types";
export declare class DiffApplier {
    /**
     * Apply a single diff block to content
     */
    applyBlock(content: string, block: DiffBlock): {
        success: boolean;
        result: string;
        error?: string;
    };
    /**
     * Apply multiple diff blocks to content sequentially
     */
    applyBlocks(content: string, blocks: DiffBlock[], options?: Partial<ApplyDiffOptions>): {
        content: string;
        applied: number;
        errors: DiffError[];
    };
    /**
     * Apply diff blocks and return a complete result
     */
    apply(filePath: string, originalContent: string, blocks: DiffBlock[], options?: Partial<ApplyDiffOptions>): DiffResult;
}
export declare const diffApplier: DiffApplier;
//# sourceMappingURL=DiffApplier.d.ts.map