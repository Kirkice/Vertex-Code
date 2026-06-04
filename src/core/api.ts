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

// ─── API 配置类型 ──────────────────────────────────────

export type ApiProviderType = "openai" | "anthropic" | "custom"

export interface ApiConfig {
	provider: ApiProviderType
	apiKey: string
	baseUrl: string
	model: string
	maxTokens?: number
	temperature?: number
}

export interface ApiProfile {
	name: string
	provider: ApiProviderType
	apiKey: string
	baseUrl: string
	model: string
	maxTokens?: number
	temperature?: number
}

// ─── API Provider 接口 ─────────────────────────────────

export interface ChatMessage {
	role: "system" | "user" | "assistant"
	content: string
}

export interface ChatResponse {
	content: string
	usage?: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
	}
}

export interface ApiProvider {
	/** 发送聊天请求 */
	chat(messages: ChatMessage[]): Promise<ChatResponse>
	
	/** 获取当前模型 ID */
	getModelId(): string
	
	/** 验证 API Key 是否有效 */
	validateApiKey(): Promise<boolean>
}

// ─── OpenAI Provider ───────────────────────────────────

export class OpenAIProvider implements ApiProvider {
	private apiKey: string
	private baseUrl: string
	private model: string
	private maxTokens: number
	private temperature: number

	constructor(config: ApiConfig) {
		this.apiKey = config.apiKey
		this.baseUrl = config.baseUrl.replace(/\/+$/, "")
		this.model = config.model
		this.maxTokens = config.maxTokens ?? 4096
		this.temperature = config.temperature ?? 0.7
	}

	async chat(messages: ChatMessage[]): Promise<ChatResponse> {
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
		})

		if (!response.ok) {
			const errorBody = await response.text()
			throw new Error(`API request failed (${response.status}): ${errorBody}`)
		}

		const data = await response.json() as {
			choices: Array<{ message: { content: string } }>
			usage?: {
				prompt_tokens: number
				completion_tokens: number
				total_tokens: number
			}
		}

		return {
			content: data.choices[0]?.message?.content || "No response from API",
			usage: data.usage ? {
				promptTokens: data.usage.prompt_tokens,
				completionTokens: data.usage.completion_tokens,
				totalTokens: data.usage.total_tokens,
			} : undefined,
		}
	}

	getModelId(): string {
		return this.model
	}

	async validateApiKey(): Promise<boolean> {
		try {
			await this.chat([{ role: "user", content: "Hi" }])
			return true
		} catch {
			return false
		}
	}
}

// ─── Anthropic Provider ────────────────────────────────

export class AnthropicProvider implements ApiProvider {
	private apiKey: string
	private baseUrl: string
	private model: string
	private maxTokens: number
	private temperature: number

	constructor(config: ApiConfig) {
		this.apiKey = config.apiKey
		this.baseUrl = config.baseUrl.replace(/\/+$/, "")
		this.model = config.model
		this.maxTokens = config.maxTokens ?? 4096
		this.temperature = config.temperature ?? 0.7
	}

	async chat(messages: ChatMessage[]): Promise<ChatResponse> {
		// 分离 system message 和对话消息
		const systemMessage = messages.find(m => m.role === "system")
		const conversationMessages = messages.filter(m => m.role !== "system")

		const requestBody: Record<string, unknown> = {
			model: this.model,
			messages: conversationMessages,
			max_tokens: this.maxTokens,
			temperature: this.temperature,
		}

		if (systemMessage) {
			requestBody.system = systemMessage.content
		}

		const response = await fetch(`${this.baseUrl}/v1/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": this.apiKey,
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify(requestBody),
		})

		if (!response.ok) {
			const errorBody = await response.text()
			throw new Error(`API request failed (${response.status}): ${errorBody}`)
		}

		const data = await response.json() as {
			content: Array<{ type: string; text: string }>
			usage?: {
				input_tokens: number
				output_tokens: number
			}
		}

		const content = data.content
			?.filter(block => block.type === "text")
			.map(block => block.text)
			.join("\n") || "No response from API"

		return {
			content,
			usage: data.usage ? {
				promptTokens: data.usage.input_tokens,
				completionTokens: data.usage.output_tokens,
				totalTokens: data.usage.input_tokens + data.usage.output_tokens,
			} : undefined,
		}
	}

	getModelId(): string {
		return this.model
	}

	async validateApiKey(): Promise<boolean> {
		try {
			await this.chat([{ role: "user", content: "Hi" }])
			return true
		} catch {
			return false
		}
	}
}

// ─── Provider 工厂函数 ─────────────────────────────────

export function createApiProvider(config: ApiConfig): ApiProvider {
	switch (config.provider) {
		case "openai":
		case "custom":
			return new OpenAIProvider(config)
		case "anthropic":
			return new AnthropicProvider(config)
		default:
			return new OpenAIProvider(config)
	}
}

// ─── 预定义模型列表 ────────────────────────────────────

export const PREDEFINED_MODELS = {
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
}

export const DEFAULT_BASE_URLS = {
	openai: "https://api.openai.com/v1",
	anthropic: "https://api.anthropic.com",
	custom: "",
}