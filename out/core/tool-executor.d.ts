/**
 * Tool Executor - Routes tool calls to actual implementations
 */
import type { SidebarViewProvider } from "../webview/SidebarViewProvider";
export interface ToolCallResult {
    success: boolean;
    output: string;
    error?: string;
}
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, {
            type: string;
            description: string;
        }>;
        required: string[];
    };
}
/**
 * Get OpenAI-compatible tool definitions for a list of tool names
 */
export declare function getToolDefinitions(toolNames: string[]): ToolDefinition[];
/**
 * Execute a tool call and return the result
 */
export declare function executeToolCall(toolName: string, args: Record<string, any>, provider: SidebarViewProvider): Promise<ToolCallResult>;
//# sourceMappingURL=tool-executor.d.ts.map