"use strict";
/**
 * Diff Service - File editing via SEARCH/REPLACE blocks
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffApplier = exports.DiffApplier = exports.diffParser = exports.DiffParser = void 0;
exports.applyDiff = applyDiff;
__exportStar(require("./types"), exports);
var DiffParser_1 = require("./DiffParser");
Object.defineProperty(exports, "DiffParser", { enumerable: true, get: function () { return DiffParser_1.DiffParser; } });
Object.defineProperty(exports, "diffParser", { enumerable: true, get: function () { return DiffParser_1.diffParser; } });
var DiffApplier_1 = require("./DiffApplier");
Object.defineProperty(exports, "DiffApplier", { enumerable: true, get: function () { return DiffApplier_1.DiffApplier; } });
Object.defineProperty(exports, "diffApplier", { enumerable: true, get: function () { return DiffApplier_1.diffApplier; } });
/**
 * Convenience function to apply a diff to file content
 */
function applyDiff(filePath, originalContent, diffText) {
    const { diffParser } = require("./DiffParser");
    const { diffApplier } = require("./DiffApplier");
    const { blocks, errors: parseErrors } = diffParser.parseWithValidation(diffText);
    if (parseErrors.length > 0) {
        return {
            success: false,
            filePath,
            originalContent,
            newContent: originalContent,
            blocksApplied: 0,
            totalBlocks: 0,
            errors: parseErrors.map((msg, i) => ({
                blockIndex: i,
                message: msg,
                searchContent: "",
            })),
        };
    }
    return diffApplier.apply(filePath, originalContent, blocks);
}
//# sourceMappingURL=index.js.map