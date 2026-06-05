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
export type ToolGroup = "read" | "edit" | "terminal" | "search" | "browser";
export type GroupEntry = ToolGroup | [ToolGroup, {
    fileRegex?: string;
    description?: string;
}];
export interface ModeConfig {
    /** 唯一标识符，如 "code"、"architect"、"ask" */
    slug: string;
    /** 显示名称，如 "Code"、"Architect" */
    name: string;
    /** 简短描述 */
    description?: string;
    /** 什么时候使用这个模式 */
    whenToUse?: string;
    /** 角色定义 — 拼入 system prompt 的核心内容 */
    roleDefinition: string;
    /** 自定义指令 — 附加到角色定义后面的补充说明 */
    customInstructions?: string;
    /** 该模式可使用的工具组列表 */
    toolGroups: GroupEntry[];
}
export declare const DEFAULT_MODES: readonly ModeConfig[];
//# sourceMappingURL=modes.d.ts.map