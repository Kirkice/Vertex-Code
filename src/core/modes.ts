/**
 * ============================================================
 *  Mini Modes - 模式引擎
 *  对应 Vertex 的 src/shared/modes.ts
 * ============================================================
 *
 *  核心逻辑：
 *  1. 模式查找 — 按 slug 查找，自定义优先 > 内置
 *  2. 模式合并 — 自定义模式可覆盖同名内置模式，或新增模式
 *  3. 模式配置 — 获取完整的模式详情（含 prompt 覆盖）
 *
 *  关键设计（与 Vertex 一致）：
 *  - 自定义模式的 slug 如果与内置相同 → 覆盖（override）
 *  - 自定义模式的 slug 如果是全新的 → 新增（add）
 *  - 查找时始终自定义优先
 */

import { type ModeConfig, type GroupEntry, DEFAULT_MODES } from "../types/modes"
import { getToolsForMode, getDisabledToolsForMode } from "./tools"

// ─── 模式查找 ──────────────────────────────────────────

/** 按 slug 查找模式（自定义优先） */
export function getModeBySlug(slug: string, customModes?: ModeConfig[]): ModeConfig | undefined {
	// 先查自定义模式
	const customMode = customModes?.find((mode) => mode.slug === slug)
	if (customMode) {
		return customMode
	}
	// 再查内置模式
	return DEFAULT_MODES.find((mode) => mode.slug === slug)
}

/** 按 slug 获取模式配置（找不到则抛异常） */
export function getModeConfig(slug: string, customModes?: ModeConfig[]): ModeConfig {
	const mode = getModeBySlug(slug, customModes)
	if (!mode) {
		throw new Error(`No mode found for slug: "${slug}"`)
	}
	return mode
}

// ─── 模式合并 ──────────────────────────────────────────

/** 获取所有模式（自定义模式覆盖或追加到内置模式） */
export function getAllModes(customModes?: ModeConfig[]): ModeConfig[] {
	if (!customModes?.length) {
		return [...DEFAULT_MODES]
	}

	// 以内置模式为基底
	const allModes = [...DEFAULT_MODES]

	// 处理自定义模式
	customModes.forEach((customMode) => {
		const index = allModes.findIndex((mode) => mode.slug === customMode.slug)
		if (index !== -1) {
			// slug 相同 → 覆盖内置模式
			allModes[index] = customMode
		} else {
			// slug 新增 → 添加新模式
			allModes.push(customMode)
		}
	})

	return allModes
}

// ─── 辅助判断 ──────────────────────────────────────────

/** 判断一个 slug 是否是自定义模式（非内置） */
export function isCustomMode(slug: string, customModes?: ModeConfig[]): boolean {
	return !!customModes?.some((mode) => mode.slug === slug)
}

/** 判断一个 slug 是否是内置模式 */
export function isBuiltInMode(slug: string): boolean {
	return DEFAULT_MODES.some((mode) => mode.slug === slug)
}

// ─── 模式详情 ──────────────────────────────────────────

/** 获取模式的可用工具列表 */
export function getModeTools(slug: string, customModes?: ModeConfig[]): string[] {
	const mode = getModeConfig(slug, customModes)
	return getToolsForMode(mode.toolGroups)
}

/** 获取模式的禁用工具列表 */
export function getModeDisabledTools(slug: string, customModes?: ModeConfig[]): string[] {
	const mode = getModeConfig(slug, customModes)
	return getDisabledToolsForMode(mode.toolGroups)
}

/** 获取模式的摘要信息（供 UI 显示） */
export function getModeSummary(slug: string, customModes?: ModeConfig[]): {
	name: string
	description: string
	enabledTools: string[]
	disabledTools: string[]
	toolGroups: GroupEntry[]
} {
	const mode = getModeConfig(slug, customModes)
	return {
		name: mode.name,
		description: mode.description || "",
		enabledTools: getToolsForMode(mode.toolGroups),
		disabledTools: getDisabledToolsForMode(mode.toolGroups),
		toolGroups: mode.toolGroups,
	}
}

// ─── 默认模式 ──────────────────────────────────────────

/** 默认模式 slug（与 Vertex 一致，默认是 "code"） */
export const defaultModeSlug = DEFAULT_MODES[0].slug