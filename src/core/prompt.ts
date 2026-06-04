/**
 * ============================================================
 *  Mini Modes - 系统提示组装
 *  对应 Roo-Code 的 src/core/prompts/ 目录
 * ============================================================
 *
 *  核心逻辑：
 *  将模式的 roleDefinition + customInstructions + 工具描述
 *  组装成完整的 system prompt，供 LLM 使用。
 *
 *  在 Roo-Code 中，这个逻辑分散在多个文件中：
 *  - src/core/prompts/sections/system.ts
 *  - src/core/prompts/sections/custom-instructions.ts
 *  - src/core/prompts/buildPrompts.ts
 *
 *  这里简化为单个文件，方便理解整体流程。
 */

import type { ModeConfig } from "../types/modes"
import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS, getGroupName, getToolsForMode } from "./tools"
import type { GroupEntry } from "../types/modes"

// ─── 系统提示组装 ──────────────────────────────────────

/**
 * 组装完整的系统提示
 *
 * 结构：
 *   1. 角色定义（roleDefinition）
 *   2. 自定义指令（customInstructions）— 如果有
 *   3. 工具描述（可用工具 + 禁用工具的说明）
 *   4. 模式约束（基于工具权限自动生成）
 */
export function buildSystemPrompt(mode: ModeConfig): string {
	const sections: string[] = []

	// ── 1. 角色定义 ──
	sections.push(`# Role\n\n${mode.roleDefinition}`)

	// ── 2. 自定义指令 ──
	if (mode.customInstructions?.trim()) {
		sections.push(`# Custom Instructions\n\n${mode.customInstructions.trim()}`)
	}

	// ── 3. 工具描述 ──
	const toolSection = buildToolSection(mode.toolGroups)
	sections.push(toolSection)

	// ── 4. 模式约束 ──
	const constraintSection = buildConstraintSection(mode)
	sections.push(constraintSection)

	return sections.join("\n\n---\n\n")
}

// ─── 工具描述组装 ──────────────────────────────────────

/** 生成工具描述段落 */
function buildToolSection(groups: readonly GroupEntry[]): string {
	const enabledTools = getToolsForMode(groups)
	const enabledGroupNames = groups.map(getGroupName)

	const lines: string[] = ["# Available Tools\n"]
	lines.push(`You have access to the following tools:\n`)

	// 按工具组展示
	enabledGroupNames.forEach((groupName) => {
		const groupConfig = TOOL_GROUPS[groupName]
		if (groupConfig) {
			lines.push(`## ${groupName}\n`)
			lines.push(`${groupConfig.description}\n`)
			groupConfig.tools.forEach((tool) => {
				lines.push(`- **${tool}**`)
			})
			lines.push("")
		}
	})

	// 常驻工具
	if (ALWAYS_AVAILABLE_TOOLS.length > 0) {
		lines.push("## Always Available\n")
		ALWAYS_AVAILABLE_TOOLS.forEach((tool) => {
			lines.push(`- **${tool}**`)
		})
		lines.push("")
	}

	// 禁用的工具组（明确告知 LLM 不能用）
	const allGroupNames = Object.keys(TOOL_GROUPS) as Array<keyof typeof TOOL_GROUPS>
	const disabledGroupNames = allGroupNames.filter((name) => !enabledGroupNames.includes(name))

	if (disabledGroupNames.length > 0) {
		lines.push("## Disabled Tools (DO NOT USE)\n")
		lines.push("The following tools are NOT available in this mode. Do not attempt to use them:\n")
		disabledGroupNames.forEach((groupName) => {
			const groupConfig = TOOL_GROUPS[groupName]
			groupConfig.tools.forEach((tool) => {
				lines.push(`- ❌ **${tool}**`)
			})
		})
		lines.push("")
	}

	return lines.join("\n")
}

// ─── 模式约束组装 ──────────────────────────────────────

/** 生成模式约束段落 */
function buildConstraintSection(mode: ModeConfig): string {
	const lines: string[] = [`# Mode Constraints\n`]
	lines.push(`You are currently in **${mode.name}** mode (slug: "${mode.slug}").\n`)

	if (mode.description) {
		lines.push(`${mode.description}\n`)
	}

	// 根据工具权限自动生成约束提示
	const enabledGroupNames = mode.toolGroups.map(getGroupName)

	if (!enabledGroupNames.includes("edit")) {
		lines.push("**You cannot edit, create, or modify files.** Only provide analysis and suggestions.")
	}

	if (!enabledGroupNames.includes("terminal")) {
		lines.push("**You cannot execute terminal commands.**")
	}

	if (!enabledGroupNames.includes("search")) {
		lines.push("**You cannot search the codebase.** You can only read files that are explicitly mentioned or provided.")
	}

	if (!enabledGroupNames.includes("browser")) {
		lines.push("**You cannot browse the web or fetch online content.**")
	}

	return lines.join("\n")
}

// ─── 用户消息组装 ──────────────────────────────────────

/** 组装用户消息（简单拼接，不做 Agent 循环） */
export function buildUserMessage(userInput: string): string {
	return userInput
}

// ─── 完整对话上下文 ──────────────────────────────────────

/** 构建完整的对话上下文（system + user） */
export function buildChatContext(mode: ModeConfig, userInput: string): {
	systemPrompt: string
	userMessage: string
} {
	return {
		systemPrompt: buildSystemPrompt(mode),
		userMessage: buildUserMessage(userInput),
	}
}