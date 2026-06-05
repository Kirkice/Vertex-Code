/**
 * Agent Loop - Core execution loop for AI Agent with tool calling
 *
 * Flow:
 * 1. Build system prompt with tool definitions
 * 2. Call LLM API with tool_choice="auto"
 * 3. Parse response for tool_calls
 * 4. Execute tools and collect results
 * 5. Feed results back to LLM
 * 6. Repeat until task completion
 */
import type { SidebarViewProvider } from "../webview/SidebarViewProvider";
import type { ModeConfig } from "../types/modes";
import type { ApiConfig } from "./api";
export interface AgentLoopOptions {
    mode: ModeConfig;
    apiConfig: ApiConfig;
    userMessage: string;
    provider: SidebarViewProvider;
    maxIterations?: number;
}
export interface AgentLoopResult {
    success: boolean;
    result: string;
    iterations: number;
    toolCalls: number;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
/**
 * Run the main agent loop
 */
export declare function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult>;
//# sourceMappingURL=agent-loop.d.ts.map