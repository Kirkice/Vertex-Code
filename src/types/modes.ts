/**
 * ============================================================
 *  Mini Modes - 类型定义
 *  对应 Vertex 的 packages/types/src/modes.ts
 * ============================================================
 *
 *  核心概念：
 *  1. ToolGroup  — 工具组枚举（决定模式能用哪些工具）
 *  2. GroupEntry — 工具组条目（可以是组名或带选项的数组）
 *  3. ModeConfig — 模式配置（slug、角色定义、工具组等）
 *  4. DEFAULT_MODES — 内置模式列表
 */

// ─── 工具组 ───────────────────────────────────────────
// 对应 Vertex 的 10 个工具组，这里简化为 5 个
export type ToolGroup = "read" | "edit" | "terminal" | "search" | "browser"

// ─── 工具组条目 ─────────────────────────────────────────
// GroupEntry 可以是纯字符串（组名），也可以是数组（组名 + 选项）
// 例如: "read" 或 ["read", { fileRegex: "*.ts" }]
export type GroupEntry = ToolGroup | [ToolGroup, { fileRegex?: string; description?: string }]

// ─── 模式配置 ───────────────────────────────────────────
export interface ModeConfig {
	/** 唯一标识符，如 "code"、"architect"、"ask" */
	slug: string

	/** 显示名称，如 "Code"、"Architect" */
	name: string

	/** 简短描述 */
	description?: string

	/** 什么时候使用这个模式 */
	whenToUse?: string

	/** 角色定义 — 拼入 system prompt 的核心内容 */
	roleDefinition: string

	/** 自定义指令 — 附加到角色定义后面的补充说明 */
	customInstructions?: string

	/** 该模式可使用的工具组列表 */
	toolGroups: GroupEntry[]
}

// ─── 内置模式 ───────────────────────────────────────────
// 对应 Vertex 的 DEFAULT_MODES（有 Code / Architect / Ask 等）
export const DEFAULT_MODES: readonly ModeConfig[] = [
	{
		slug: "code",
		name: "Code",
		description: "Full coding mode - can read, edit, run terminal commands, search, and browse",
		whenToUse: "Use for general coding tasks, writing code, debugging, and file editing",
		roleDefinition: "You are an expert software engineer. You can read files, write and edit code, execute terminal commands, search the codebase, and browse documentation. Your primary goal is to help the user with coding tasks efficiently and accurately.",
		customInstructions: "Always consider the existing code context before making changes. Prefer minimal, targeted edits over large rewrites.",
		toolGroups: ["read", "edit", "terminal", "search", "browser"],
	},
	{
		slug: "architect",
		name: "Architect",
		description: "Planning and design mode - can read files and search, but cannot edit",
		whenToUse: "Use for code review, architecture planning, and design discussions where you want to think before making changes",
		roleDefinition: "You are an expert software architect. You can read files and search the codebase, but you cannot edit files or execute commands. Your primary goal is to analyze code, propose designs, and discuss architectural decisions with the user before implementation.",
		customInstructions: "Focus on providing clear, well-structured analysis and design proposals. When suggesting changes, be specific about which files need modification and what the changes should look like.",
		toolGroups: ["read", "search"],
	},
	{
		slug: "ask",
		name: "Ask",
		description: "Question mode - can only read files, for quick questions",
		whenToUse: "Use for quick questions about the codebase where you don't need to search extensively",
		roleDefinition: "You are a knowledgeable coding assistant. You can read files but cannot search the codebase, edit files, or execute commands. Your primary goal is to answer the user's questions quickly and accurately based on the files you can see.",
		customInstructions: "Be concise and direct in your answers. If you need more context than you can access, let the user know.",
		toolGroups: ["read"],
	},
]