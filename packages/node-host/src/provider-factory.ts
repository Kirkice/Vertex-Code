import type { ModelProvider, ProviderProfile } from "@vertex/agent-runtime"

import { OpenAiCompatibleProvider, type OpenAiCompatibleConfig } from "./NodeHost.js"

/**
 * CLI 统一使用 OpenAI Chat Completions 工具调用协议作为供应商传输层。
 * OpenRouter、Ollama、LM Studio、Azure OpenAI 和兼容网关都能通过不同
 * base URL 复用该适配器；不兼容的 provider 会在配置装配阶段明确失败。
 */
export const openAiCompatibleProviderKinds = new Set([
  "openai",
  "openai-compatible",
  "openrouter",
  "ollama",
  "lmstudio",
  "azure-openai",
  "vertex-gateway",
])

export function createModelProvider(profile: ProviderProfile, apiKey: string): ModelProvider {
  const provider = profile.provider.trim().toLowerCase()
  if (!openAiCompatibleProviderKinds.has(provider)) {
    throw new Error(`CLI 尚未支持 Provider：${profile.provider}。请使用 OpenAI 兼容 Provider 或配置 VERTEX_* 环境变量。`)
  }

  const config: OpenAiCompatibleConfig = {
    apiKey,
    baseUrl: profile.baseUrl.replace(/\/$/, ""),
    model: profile.model,
  }
  return new OpenAiCompatibleProvider(config)
}
