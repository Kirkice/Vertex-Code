"use strict";
/**
 * ============================================================
 *  Mini Modes - 模式引擎
 *  对应 Roo-Code 的 src/shared/modes.ts
 * ============================================================
 *
 *  核心逻辑：
 *  1. 模式查找 — 按 slug 查找，自定义优先 > 内置
 *  2. 模式合并 — 自定义模式可覆盖同名内置模式，或新增模式
 *  3. 模式配置 — 获取完整的模式详情（含 prompt 覆盖）
 *
 *  关键设计（与 Roo-Code 一致）：
 *  - 自定义模式的 slug 如果与内置相同 → 覆盖（override）
 *  - 自定义模式的 slug 如果是全新的 → 新增（add）
 *  - 查找时始终自定义优先
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultModeSlug = void 0;
exports.getModeBySlug = getModeBySlug;
exports.getModeConfig = getModeConfig;
exports.getAllModes = getAllModes;
exports.isCustomMode = isCustomMode;
exports.isBuiltInMode = isBuiltInMode;
exports.getModeTools = getModeTools;
exports.getModeDisabledTools = getModeDisabledTools;
exports.getModeSummary = getModeSummary;
const modes_1 = require("../types/modes");
const tools_1 = require("./tools");
// ─── 模式查找 ──────────────────────────────────────────
/** 按 slug 查找模式（自定义优先） */
function getModeBySlug(slug, customModes) {
    // 先查自定义模式
    const customMode = customModes?.find((mode) => mode.slug === slug);
    if (customMode) {
        return customMode;
    }
    // 再查内置模式
    return modes_1.DEFAULT_MODES.find((mode) => mode.slug === slug);
}
/** 按 slug 获取模式配置（找不到则抛异常） */
function getModeConfig(slug, customModes) {
    const mode = getModeBySlug(slug, customModes);
    if (!mode) {
        throw new Error(`No mode found for slug: "${slug}"`);
    }
    return mode;
}
// ─── 模式合并 ──────────────────────────────────────────
/** 获取所有模式（自定义模式覆盖或追加到内置模式） */
function getAllModes(customModes) {
    if (!customModes?.length) {
        return [...modes_1.DEFAULT_MODES];
    }
    // 以内置模式为基底
    const allModes = [...modes_1.DEFAULT_MODES];
    // 处理自定义模式
    customModes.forEach((customMode) => {
        const index = allModes.findIndex((mode) => mode.slug === customMode.slug);
        if (index !== -1) {
            // slug 相同 → 覆盖内置模式
            allModes[index] = customMode;
        }
        else {
            // slug 新增 → 添加新模式
            allModes.push(customMode);
        }
    });
    return allModes;
}
// ─── 辅助判断 ──────────────────────────────────────────
/** 判断一个 slug 是否是自定义模式（非内置） */
function isCustomMode(slug, customModes) {
    return !!customModes?.some((mode) => mode.slug === slug);
}
/** 判断一个 slug 是否是内置模式 */
function isBuiltInMode(slug) {
    return modes_1.DEFAULT_MODES.some((mode) => mode.slug === slug);
}
// ─── 模式详情 ──────────────────────────────────────────
/** 获取模式的可用工具列表 */
function getModeTools(slug, customModes) {
    const mode = getModeConfig(slug, customModes);
    return (0, tools_1.getToolsForMode)(mode.toolGroups);
}
/** 获取模式的禁用工具列表 */
function getModeDisabledTools(slug, customModes) {
    const mode = getModeConfig(slug, customModes);
    return (0, tools_1.getDisabledToolsForMode)(mode.toolGroups);
}
/** 获取模式的摘要信息（供 UI 显示） */
function getModeSummary(slug, customModes) {
    const mode = getModeConfig(slug, customModes);
    return {
        name: mode.name,
        description: mode.description || "",
        enabledTools: (0, tools_1.getToolsForMode)(mode.toolGroups),
        disabledTools: (0, tools_1.getDisabledToolsForMode)(mode.toolGroups),
        toolGroups: mode.toolGroups,
    };
}
// ─── 默认模式 ──────────────────────────────────────────
/** 默认模式 slug（与 Roo-Code 一致，默认是 "code"） */
exports.defaultModeSlug = modes_1.DEFAULT_MODES[0].slug;
//# sourceMappingURL=modes.js.map