/**
 * ============================================================
 *  Mini Modes - 工具组定义
 *  对应 Roo-Code 的 src/shared/tools.ts
 * ============================================================
 *
 *  核心概念：
 *  - TOOL_GROUPS: 每个工具组包含哪些具体工具名
 *  - ALWAYS_AVAILABLE_TOOLS: 无论什么模式都可用的工具
 *
 *  在 Roo-Code 中有 10 个工具组，这里简化为 5 个：
 *    read → 读取文件
 *    edit → 编辑/写入文件
 *    terminal → 执行终端命令
 *    search → 搜索代码库
 *    browser → 浏览网页/文档
 */
import type { ToolGroup, GroupEntry } from "../types/modes";
export declare const TOOL_GROUPS: Record<ToolGroup, {
    tools: string[];
    description: string;
}>;
export declare const ALWAYS_AVAILABLE_TOOLS: string[];
/** 从 GroupEntry 中提取组名（无论格式是字符串还是数组） */
export declare function getGroupName(group: GroupEntry): ToolGroup;
/** 从 GroupEntry 中提取组选项（如果是数组格式） */
export declare function getGroupOptions(group: GroupEntry): {
    fileRegex?: string;
    description?: string;
} | undefined;
/** 获取一个模式的所有可用工具名 */
export declare function getToolsForMode(groups: readonly GroupEntry[]): string[];
/** 获取一个模式中不可用的工具名（对比全量工具） */
export declare function getDisabledToolsForMode(groups: readonly GroupEntry[]): string[];
//# sourceMappingURL=tools.d.ts.map