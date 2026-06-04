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
import { type ModeConfig, type GroupEntry } from "../types/modes";
/** 按 slug 查找模式（自定义优先） */
export declare function getModeBySlug(slug: string, customModes?: ModeConfig[]): ModeConfig | undefined;
/** 按 slug 获取模式配置（找不到则抛异常） */
export declare function getModeConfig(slug: string, customModes?: ModeConfig[]): ModeConfig;
/** 获取所有模式（自定义模式覆盖或追加到内置模式） */
export declare function getAllModes(customModes?: ModeConfig[]): ModeConfig[];
/** 判断一个 slug 是否是自定义模式（非内置） */
export declare function isCustomMode(slug: string, customModes?: ModeConfig[]): boolean;
/** 判断一个 slug 是否是内置模式 */
export declare function isBuiltInMode(slug: string): boolean;
/** 获取模式的可用工具列表 */
export declare function getModeTools(slug: string, customModes?: ModeConfig[]): string[];
/** 获取模式的禁用工具列表 */
export declare function getModeDisabledTools(slug: string, customModes?: ModeConfig[]): string[];
/** 获取模式的摘要信息（供 UI 显示） */
export declare function getModeSummary(slug: string, customModes?: ModeConfig[]): {
    name: string;
    description: string;
    enabledTools: string[];
    disabledTools: string[];
    toolGroups: GroupEntry[];
};
/** 默认模式 slug（与 Roo-Code 一致，默认是 "code"） */
export declare const defaultModeSlug: string;
//# sourceMappingURL=modes.d.ts.map