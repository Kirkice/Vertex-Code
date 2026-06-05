"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgentLoop = runAgentLoop;
const api_1 = require("./api");
const tools_1 = require("./tools");
const tool_executor_1 = require("./tool-executor");
const prompt_1 = require("./prompt");
/**
 * Run the main agent loop
 */
async function runAgentLoop(options) {
    const { mode, apiConfig, userMessage, provider, maxIterations = 20 } = options;
    const telemetry = provider.getTelemetryService();
    const persistence = provider.getPersistenceService();
    const taskManager = provider.getTaskManager();
    // Get tools available for this mode
    const toolNames = (0, tools_1.getToolsForMode)(mode.toolGroups);
    const toolDefs = (0, tool_executor_1.getToolDefinitions)(toolNames);
    // Build system prompt
    const systemPrompt = (0, prompt_1.buildSystemPrompt)(mode);
    // Initialize message history
    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
    ];
    // Track usage and iterations
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let iterations = 0;
    let toolCallsCount = 0;
    let finalResult = "";
    // Create or get active task
    let task = taskManager.getActiveTask();
    if (!task) {
        task = taskManager.createTask({
            mode: mode.slug,
            message: userMessage,
        });
        taskManager.startTask(task.id);
    }
    // Initialize checkpoint for this task
    await provider.saveCheckpoint(`task_start: ${task.id}`, true);
    try {
        while (iterations < maxIterations) {
            iterations++;
            // Notify webview of iteration progress
            provider.postMessage({
                type: "agentProgress",
                iteration: iterations,
                maxIterations,
            });
            // Track API call start
            const apiStartTime = Date.now();
            // Call LLM API with tools
            const apiProvider = (0, api_1.createApiProvider)(apiConfig);
            const response = await callApiWithTools(apiProvider, messages, toolDefs);
            // Track API call
            const apiDuration = Date.now() - apiStartTime;
            if (response.usage) {
                totalUsage.promptTokens += response.usage.promptTokens;
                totalUsage.completionTokens += response.usage.completionTokens;
                totalUsage.totalTokens += response.usage.totalTokens;
            }
            telemetry.trackApiRequest(apiConfig.provider, apiConfig.model, response.usage?.promptTokens || 0, response.usage?.completionTokens || 0, apiDuration, true);
            // Parse response
            const assistantMessage = response;
            const content = assistantMessage.content || "";
            const toolCalls = assistantMessage.tool_calls || [];
            // Add assistant message to history
            messages.push({
                role: "assistant",
                content: content,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            });
            // Save message to persistence
            if (persistence && task) {
                persistence.addMessage(task.id, {
                    role: "assistant",
                    content: content,
                    timestamp: Date.now(),
                });
            }
            // If no tool calls, we're done
            if (toolCalls.length === 0) {
                finalResult = content;
                break;
            }
            // Execute each tool call
            for (const toolCall of toolCalls) {
                toolCallsCount++;
                const toolName = toolCall.function.name;
                let toolArgs = {};
                try {
                    toolArgs = JSON.parse(toolCall.function.arguments);
                }
                catch {
                    toolArgs = {};
                }
                // Notify webview of tool execution
                provider.postMessage({
                    type: "toolExecution",
                    toolName,
                    args: toolArgs,
                    status: "running",
                });
                // Track tool usage
                const toolStartTime = Date.now();
                // Execute the tool
                const toolResult = await (0, tool_executor_1.executeToolCall)(toolName, toolArgs, provider);
                // Track tool usage
                const toolDuration = Date.now() - toolStartTime;
                telemetry.trackToolUse(toolName, mode.slug, toolResult.success, toolDuration, toolResult.error);
                // Check if task is complete
                if (toolName === "attempt_completion" && toolResult.success) {
                    finalResult = toolResult.output;
                    // Add tool result to messages
                    messages.push({
                        role: "tool",
                        content: toolResult.output,
                        tool_call_id: toolCall.id,
                        name: toolName,
                    });
                    // Complete the task
                    taskManager.completeTask(task.id, finalResult);
                    await provider.saveCheckpoint(`task_complete: ${task.id}`);
                    // Notify webview
                    provider.postMessage({
                        type: "toolExecution",
                        toolName,
                        result: toolResult,
                        status: "completed",
                    });
                    return {
                        success: true,
                        result: finalResult,
                        iterations,
                        toolCalls: toolCallsCount,
                        usage: totalUsage,
                    };
                }
                // Add tool result to messages
                const toolOutput = toolResult.success
                    ? toolResult.output
                    : `Error: ${toolResult.error}`;
                messages.push({
                    role: "tool",
                    content: toolOutput,
                    tool_call_id: toolCall.id,
                    name: toolName,
                });
                // Save tool execution to persistence
                if (persistence && task) {
                    persistence.addMessage(task.id, {
                        role: "assistant",
                        content: `[Tool: ${toolName}]\n${toolOutput}`,
                        timestamp: Date.now(),
                    });
                }
                // Notify webview of tool completion
                provider.postMessage({
                    type: "toolExecution",
                    toolName,
                    result: toolResult,
                    status: toolResult.success ? "success" : "error",
                });
            }
        }
        // If we reached max iterations without completion
        if (iterations >= maxIterations && !finalResult) {
            finalResult = "Task incomplete: reached maximum iterations";
            if (task) {
                taskManager.failTask(task.id, finalResult);
            }
        }
        // Final checkpoint
        await provider.saveCheckpoint(`task_end: ${task?.id || "unknown"}`);
        return {
            success: true,
            result: finalResult,
            iterations,
            toolCalls: toolCallsCount,
            usage: totalUsage,
        };
    }
    catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        // Track error
        telemetry.trackError("agent_loop", errMsg, error instanceof Error ? error.stack : undefined);
        if (task) {
            taskManager.failTask(task.id, errMsg);
        }
        return {
            success: false,
            result: `Error: ${errMsg}`,
            iterations,
            toolCalls: toolCallsCount,
            usage: totalUsage,
        };
    }
}
/**
 * Call API with tool definitions
 */
async function callApiWithTools(apiProvider, messages, tools) {
    // For OpenAI-compatible APIs, add tools to the request
    if (apiProvider.constructor.name === "OpenAIProvider" || apiProvider.constructor.name === "AnthropicProvider") {
        // We need to modify the API call to include tools
        // This requires extending the API provider interface
        return await apiProvider.chatWithTools(messages, tools);
    }
    // Fallback to regular chat
    return await apiProvider.chat(messages);
}
//# sourceMappingURL=agent-loop.js.map