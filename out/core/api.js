"use strict";
/**
 * ============================================================
 *  Mini Modes - API Provider 抽象层
 *  参考 Vertex 的 src/api/providers/ 设计
 * ============================================================
 *
 *  核心概念：
 *  1. ApiProvider 接口 — 定义统一的聊天接口
 *  2. OpenAIProvider — OpenAI 兼容 API 实现
 *  3. AnthropicProvider — Anthropic API 实现
 *  4. createApiProvider — 工厂函数，根据配置创建 Provider
 *
 *  设计目标：
 *  - 易于扩展新的 Provider（只需实现 ApiProvider 接口）
 *  - 配置与实现分离
 *  - 支持流式响应（预留接口）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BASE_URLS = exports.PREDEFINED_MODELS = exports.AnthropicProvider = exports.OpenAIProvider = void 0;
exports.createApiProvider = createApiProvider;
// ─── OpenAI Provider ───────────────────────────────────
class OpenAIProvider {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl.replace(/\/+$/, "");
        this.model = config.model;
        this.maxTokens = config.maxTokens ?? 4096;
        this.temperature = config.temperature ?? 0.7;
    }
    async chat(messages) {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages,
                max_tokens: this.maxTokens,
                temperature: this.temperature,
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API request failed (${response.status}): ${errorBody}`);
        }
        const data = await response.json();
        return {
            content: data.choices[0]?.message?.content || "No response from API",
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            } : undefined,
        };
    }
    async chatWithTools(messages, tools) {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages,
                tools: tools.map(t => ({
                    type: "function",
                    function: {
                        name: t.name,
                        description: t.description,
                        parameters: t.parameters,
                    },
                })),
                tool_choice: "auto",
                max_tokens: this.maxTokens,
                temperature: this.temperature,
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API request failed (${response.status}): ${errorBody}`);
        }
        const data = await response.json();
        const message = data.choices[0]?.message;
        return {
            content: message?.content || "",
            tool_calls: message?.tool_calls,
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            } : undefined,
        };
    }
    getModelId() {
        return this.model;
    }
    async validateApiKey() {
        try {
            await this.chat([{ role: "user", content: "Hi" }]);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.OpenAIProvider = OpenAIProvider;
// ─── Anthropic Provider ────────────────────────────────
class AnthropicProvider {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl.replace(/\/+$/, "");
        this.model = config.model;
        this.maxTokens = config.maxTokens ?? 4096;
        this.temperature = config.temperature ?? 0.7;
    }
    async chat(messages) {
        // 分离 system message 和对话消息
        const systemMessage = messages.find(m => m.role === "system");
        const conversationMessages = messages.filter(m => m.role !== "system");
        const requestBody = {
            model: this.model,
            messages: conversationMessages,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
        };
        if (systemMessage) {
            requestBody.system = systemMessage.content;
        }
        const response = await fetch(`${this.baseUrl}/v1/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": this.apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API request failed (${response.status}): ${errorBody}`);
        }
        const data = await response.json();
        const content = data.content
            ?.filter(block => block.type === "text")
            .map(block => block.text)
            .join("\n") || "No response from API";
        return {
            content,
            usage: data.usage ? {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens,
            } : undefined,
        };
    }
    async chatWithTools(messages, tools) {
        // 分离 system message 和对话消息
        const systemMessage = messages.find(m => m.role === "system");
        const conversationMessages = messages.filter(m => m.role !== "system");
        // Convert tools to Anthropic format
        const anthropicTools = tools.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters,
        }));
        const requestBody = {
            model: this.model,
            messages: conversationMessages,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            tools: anthropicTools,
        };
        if (systemMessage) {
            requestBody.system = systemMessage.content;
        }
        const response = await fetch(`${this.baseUrl}/v1/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": this.apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API request failed (${response.status}): ${errorBody}`);
        }
        const data = await response.json();
        // Extract text and tool_use blocks
        const textContent = data.content
            ?.filter(block => block.type === "text")
            .map(block => block.text || "")
            .join("\n") || "";
        const toolUseBlocks = data.content
            ?.filter(block => block.type === "tool_use")
            .map(block => ({
            id: block.id || "",
            type: "function",
            function: {
                name: block.name || "",
                arguments: JSON.stringify(block.input || {}),
            },
        }));
        return {
            content: textContent,
            tool_calls: toolUseBlocks.length > 0 ? toolUseBlocks : undefined,
            usage: data.usage ? {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens,
            } : undefined,
        };
    }
    getModelId() {
        return this.model;
    }
    async validateApiKey() {
        try {
            await this.chat([{ role: "user", content: "Hi" }]);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.AnthropicProvider = AnthropicProvider;
// ─── Provider 工厂函数 ─────────────────────────────────
function createApiProvider(config) {
    switch (config.provider) {
        case "openai":
        case "custom":
            return new OpenAIProvider(config);
        case "anthropic":
            return new AnthropicProvider(config);
        default:
            return new OpenAIProvider(config);
    }
}
// ─── 预定义模型列表 ────────────────────────────────────
exports.PREDEFINED_MODELS = {
    openai: [
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
        { id: "gpt-4", name: "GPT-4" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    ],
    anthropic: [
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
        { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
        { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" },
    ],
    custom: [
        { id: "custom-model", name: "Custom Model" },
    ],
};
exports.DEFAULT_BASE_URLS = {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com",
    custom: "",
};
//# sourceMappingURL=api.js.map