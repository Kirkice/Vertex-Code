/**
 * ============================================================
 *  Mini Modes - 系统提示组装
 *  对应 Vertex 的 src/core/prompts/ 目录
 * ============================================================
 *
 *  核心逻辑：
 *  将模式的 roleDefinition + customInstructions + 工具描述
 *  组装成完整的 system prompt，供 LLM 使用。
 *
 *  在 Vertex 中，这个逻辑分散在多个文件中：
 *  - src/core/prompts/sections/system.ts
 *  - src/core/prompts/sections/custom-instructions.ts
 *  - src/core/prompts/buildPrompts.ts
 *
 *  这里简化为单个文件，方便理解整体流程。
 */
import type { ModeConfig } from "../types/modes";
/**
 * 组装完整的系统提示
 *
 * 结构：
 *   1. 角色定义（roleDefinition）
 *   2. 自定义指令（customInstructions）— 如果有
 *   3. 工具描述（可用工具 + 禁用工具的说明）
 *   4. 模式约束（基于工具权限自动生成）
 */
export declare function buildSystemPrompt(mode: ModeConfig): string;
/** 组装用户消息（简单拼接，不做 Agent 循环） */
export declare function buildUserMessage(userInput: string): string;
/** 构建完整的对话上下文（system + user） */
export declare function buildChatContext(mode: ModeConfig, userInput: string): {
    systemPrompt: string;
    userMessage: string;
};
//# sourceMappingURL=prompt.d.ts.map