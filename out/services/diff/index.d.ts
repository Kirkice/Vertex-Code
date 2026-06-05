/**
 * Diff Service - File editing via SEARCH/REPLACE blocks
 */
export * from "./types";
export { DiffParser, diffParser } from "./DiffParser";
export { DiffApplier, diffApplier } from "./DiffApplier";
/**
 * Convenience function to apply a diff to file content
 */
export declare function applyDiff(filePath: string, originalContent: string, diffText: string): any;
//# sourceMappingURL=index.d.ts.map