import { randomUUID } from "node:crypto"

import type {
  AgentToolCall,
  ModelProvider,
  ModelRequest,
  ModelStreamEvent,
} from "@vertex/agent-runtime"

/**
 * 原生 Provider 适配器只负责协议转换，不负责配置持久化和重试策略。
 * 这样每个供应商的认证头、消息结构和流式帧都不会污染通用 OpenAI 适配器。
 */
export class AnthropicProvider implements ModelProvider {
  constructor(
    private readonly config: { apiKey: string; baseUrl: string; model: string; maxTokens?: number },
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamEvent> {
    const response = await this.fetcher(`${this.config.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: request.signal,
      body: JSON.stringify(toAnthropicRequest(this.config.model, this.config.maxTokens ?? 8192, request)),
    })
    if (!response.ok || !response.body) throw new Error(`Anthropic 请求失败（HTTP ${response.status}）：${await response.text()}`)

    const tools = new Map<number, { id: string; name: string; input: Record<string, unknown> }>()
    for await (const event of readSse(response.body)) {
      const data = event.data as Record<string, unknown>
      if (event.event === "content_block_delta") {
        const delta = asRecord(data.delta)
        if (typeof delta.text === "string") yield { type: "text_delta", text: delta.text }
        const partial = asRecord(delta.partial_json)
        if (typeof delta.partial_json === "string") {
          const index = numberValue(data.index) ?? 0
          const current = tools.get(index) ?? { id: "", name: "", input: {} }
          try { current.input = JSON.parse(`${JSON.stringify(current.input).slice(0, -1)}${delta.partial_json}}`) as Record<string, unknown> } catch { /* 等待完整 JSON */ }
          tools.set(index, current)
        }
        void partial
      } else if (event.event === "content_block_start") {
        const block = asRecord(data.content_block)
        if (block.type === "tool_use") tools.set(numberValue(data.index) ?? 0, { id: stringValue(block.id) ?? randomUUID(), name: stringValue(block.name) ?? "", input: asRecord(block.input) })
      } else if (event.event === "message_delta") {
        const usage = asRecord(data.usage)
        if (usage.input_tokens !== undefined || usage.output_tokens !== undefined) yield { type: "usage", usage: { inputTokens: numberValue(usage.input_tokens), outputTokens: numberValue(usage.output_tokens) } }
      } else if (event.event === "message_stop") {
        for (const tool of tools.values()) yield { type: "tool_call", toolCall: { id: tool.id, name: tool.name, input: tool.input } }
        yield { type: "done", finishReason: tools.size ? "tool_calls" : "stop" }
      }
    }
  }
}

export class GeminiProvider implements ModelProvider {
  constructor(
    private readonly config: { apiKey: string; baseUrl: string; model: string },
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamEvent> {
    const endpoint = `${this.config.baseUrl}/models/${encodeURIComponent(this.config.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.config.apiKey)}`
    const response = await this.fetcher(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: request.signal,
      body: JSON.stringify(toGeminiRequest(request)),
    })
    if (!response.ok || !response.body) throw new Error(`Gemini 请求失败（HTTP ${response.status}）：${await response.text()}`)
    const calls = new Map<string, AgentToolCall>()
    for await (const event of readSse(response.body)) {
      const candidates = Array.isArray(event.data.candidates) ? event.data.candidates : []
      for (const candidate of candidates) {
        const content = asRecord(asRecord(candidate).content)
        const parts = Array.isArray(content.parts) ? content.parts : []
        for (const part of parts) {
          const value = asRecord(part)
          if (typeof value.text === "string") yield { type: "text_delta", text: value.text }
          const call = asRecord(value.functionCall)
          if (call.name) {
            const id = stringValue(call.id) ?? `${call.name}-${calls.size}`
            calls.set(id, { id, name: String(call.name), input: asRecord(call.args) })
          }
        }
      }
      const usage = asRecord(event.data.usageMetadata)
      if (usage.promptTokenCount !== undefined || usage.candidatesTokenCount !== undefined) yield { type: "usage", usage: { inputTokens: numberValue(usage.promptTokenCount), outputTokens: numberValue(usage.candidatesTokenCount) } }
    }
    for (const toolCall of calls.values()) yield { type: "tool_call", toolCall }
    yield { type: "done", finishReason: calls.size ? "tool_calls" : "stop" }
  }
}

function toAnthropicRequest(model: string, maxTokens: number, request: ModelRequest): Record<string, unknown> {
  const system = request.messages.find((message) => message.role === "system")?.content
  return {
    model,
    max_tokens: maxTokens,
    stream: true,
    system,
    messages: request.messages.filter((message) => message.role !== "system").map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content })),
    tools: request.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })),
  }
}

function toGeminiRequest(request: ModelRequest): Record<string, unknown> {
  const system = request.messages.find((message) => message.role === "system")
  return {
    systemInstruction: system ? { parts: [{ text: system.content }] } : undefined,
    contents: request.messages.filter((message) => message.role !== "system").map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
    tools: [{ functionDeclarations: request.tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })) }],
  }
}

async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event?: string; data: Record<string, unknown> }> {
  const decoder = new TextDecoder()
  let buffer = ""
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true })
    const records = buffer.split(/\r?\n\r?\n/)
    buffer = records.pop() ?? ""
    for (const record of records) {
      const dataLine = record.split(/\r?\n/).find((line) => line.startsWith("data:"))
      if (!dataLine) continue
      try { yield { event: record.match(/^event:\s*(.+)$/m)?.[1], data: JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown> } } catch { /* 忽略供应商 keep-alive/残缺帧 */ }
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function stringValue(value: unknown): string | undefined { return typeof value === "string" && value ? value : undefined }
function numberValue(value: unknown): number | undefined { return typeof value === "number" ? value : undefined }
