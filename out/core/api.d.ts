/**
 * ============================================================
 *  Mini Modes - API Provider 抽象层
 *  参考 Roo-Code 的 src/api/providers/ 设计
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
export type ApiProviderType = "openai" | "anthropic" | "custom";
export interface ApiConfig {
    provider: ApiProviderType;
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
}
export interface ApiProfile {
    name: string;
    provider: ApiProviderType;
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
}
export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface ChatResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
export interface ApiProvider {
    /** 发送聊天请求 */
    chat(messages: ChatMessage[]): Promise<ChatResponse>;
    /** 获取当前模型 ID */
    getModelId(): string;
    /** 验证 API Key 是否有效 */
    validateApiKey(): Promise<boolean>;
}
export declare class OpenAIProvider implements ApiProvider {
    private apiKey;
    private baseUrl;
    private model;
    private maxTokens;
    private temperature;
    constructor(config: ApiConfig);
    chat(messages: ChatMessage[]): Promise<ChatResponse>;
    getModelId(): string;
    validateApiKey(): Promise<boolean>;
}
export declare class AnthropicProvider implements ApiProvider {
    private apiKey;
    private baseUrl;
    private model;
    private maxTokens;
    private temperature;
    constructor(config: ApiConfig);
    chat(messages: ChatMessage[]): Promise<ChatResponse>;
    getModelId(): string;
    validateApiKey(): Promise<boolean>;
}
export declare function createApiProvider(config: ApiConfig): ApiProvider;
export declare const PREDEFINED_MODELS: {
    openai: {
        id: string;
        name: string;
    }[];
    anthropic: {
        id: string;
        name: string;
    }[];
    custom: {
        id: string;
        name: string;
    }[];
};
export declare const DEFAULT_BASE_URLS: {
    openai: string;
    anthropic: string;
    custom: string;
};
//# sourceMappingURL=api.d.ts.map