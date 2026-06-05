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
import type { DiffBlock } from "./types";
export declare class DiffParser {
    /**
     * Parse diff text into blocks
     */
    parse(diffText: string): DiffBlock[];
    /**
     * Validate that a diff block has valid format
     */
    validateBlock(block: DiffBlock): {
        valid: boolean;
        error?: string;
    };
    /**
     * Parse and validate diff text, returning blocks and errors
     */
    parseWithValidation(diffText: string): {
        blocks: DiffBlock[];
        errors: string[];
    };
}
export declare const diffParser: DiffParser;
//# sourceMappingURL=DiffParser.d.ts.map