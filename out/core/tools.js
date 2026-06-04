"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALWAYS_AVAILABLE_TOOLS = exports.TOOL_GROUPS = void 0;
exports.getGroupName = getGroupName;
exports.getGroupOptions = getGroupOptions;
exports.getToolsForMode = getToolsForMode;
exports.getDisabledToolsForMode = getDisabledToolsForMode;
// ─── 工具组 → 工具名映射 ──────────────────────────────
exports.TOOL_GROUPS = {
    read: {
        tools: ["read_file", "list_files"],
        description: "Read files and list directory contents",
    },
    edit: {
        tools: ["write_to_file", "replace_in_file", "create_file"],
        description: "Write, edit, and create files",
    },
    terminal: {
        tools: ["execute_command"],
        description: "Execute terminal/shell commands",
    },
    search: {
        tools: ["search_files", "search_regex"],
        description: "Search the codebase for patterns",
    },
    browser: {
        tools: ["browse_url", "fetch_content"],
        description: "Browse web pages and fetch online content",
    },
};
// ─── 常驻可用工具 ──────────────────────────────────────
// 这些工具在任何模式下都可用（不需要声明在 toolGroups 中）
exports.ALWAYS_AVAILABLE_TOOLS = ["ask_followup_question"];
// ─── 辅助函数 ──────────────────────────────────────────
/** 从 GroupEntry 中提取组名（无论格式是字符串还是数组） */
function getGroupName(group) {
    if (typeof group === "string") {
        return group;
    }
    return group[0];
}
/** 从 GroupEntry 中提取组选项（如果是数组格式） */
function getGroupOptions(group) {
    if (typeof group === "string") {
        return undefined;
    }
    return group[1];
}
/** 获取一个模式的所有可用工具名 */
function getToolsForMode(groups) {
    const tools = new Set();
    // 从每个工具组中提取工具名
    groups.forEach((group) => {
        const groupName = getGroupName(group);
        const groupConfig = exports.TOOL_GROUPS[groupName];
        if (groupConfig) {
            groupConfig.tools.forEach((tool) => tools.add(tool));
        }
    });
    // 添加常驻工具
    exports.ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool));
    return Array.from(tools);
}
/** 获取一个模式中不可用的工具名（对比全量工具） */
function getDisabledToolsForMode(groups) {
    const allTools = new Set();
    Object.values(exports.TOOL_GROUPS).forEach((group) => {
        group.tools.forEach((tool) => allTools.add(tool));
    });
    exports.ALWAYS_AVAILABLE_TOOLS.forEach((tool) => allTools.add(tool));
    const enabledTools = new Set(getToolsForMode(groups));
    return Array.from(allTools).filter((tool) => !enabledTools.has(tool));
}
//# sourceMappingURL=tools.js.map