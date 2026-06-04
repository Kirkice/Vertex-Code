import type { TokenUsage, ToolUsage, ToolName, ClineMessage } from "@roo-code/types"

export type ParsedApiReqStartedTextType = {
	tokensIn: number
	tokensOut: number
	cacheWrites: number
	cacheReads: number
	cost?: number
	apiProtocol?: "anthropic" | "openai"
}

export function getApiMetrics(messages: ClineMessage[]): TokenUsage {
	const result: TokenUsage = {
		totalTokensIn: 0,
		totalTokensOut: 0,
		totalCacheWrites: undefined,
		totalCacheReads: undefined,
		totalCost: 0,
		contextTokens: 0,
	}

	messages.forEach((message) => {
		if (message.type === "say" && message.say === "api_req_started" && message.text) {
			try {
				const parsedText: ParsedApiReqStartedTextType = JSON.parse(message.text)
				const { tokensIn, tokensOut, cacheWrites, cacheReads, cost } = parsedText
				if (typeof tokensIn === "number") result.totalTokensIn += tokensIn
				if (typeof tokensOut === "number") result.totalTokensOut += tokensOut
				if (typeof cacheWrites === "number") result.totalCacheWrites = (result.totalCacheWrites ?? 0) + cacheWrites
				if (typeof cacheReads === "number") result.totalCacheReads = (result.totalCacheReads ?? 0) + cacheReads
				if (typeof cost === "number") result.totalCost += cost
			} catch { /* ignore */ }
		} else if (message.type === "say" && message.say === "condense_context") {
			result.totalCost += message.contextCondense?.cost ?? 0
		}
	})

	result.contextTokens = 0
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i]
		if (!message) continue
		if (message.type === "say" && message.say === "api_req_started" && message.text) {
			try {
				const parsedText: ParsedApiReqStartedTextType = JSON.parse(message.text)
				const { tokensIn, tokensOut } = parsedText
				result.contextTokens = (tokensIn || 0) + (tokensOut || 0)
			} catch { continue }
		} else if (message.type === "say" && message.say === "condense_context") {
			result.contextTokens = message.contextCondense?.newContextTokens ?? 0
		}
		if (result.contextTokens) break
	}
	return result
}

export function hasTokenUsageChanged(current: TokenUsage, snapshot?: TokenUsage): boolean {
	if (!snapshot) return true
	const keysToCompare: (keyof TokenUsage)[] = ["totalTokensIn","totalTokensOut","totalCacheWrites","totalCacheReads","totalCost","contextTokens"]
	return keysToCompare.some((key) => current[key] !== snapshot[key])
}

export function hasToolUsageChanged(current: ToolUsage, snapshot?: ToolUsage): boolean {
	const effectiveSnapshot = snapshot ?? {}
	const currentKeys = Object.keys(current) as ToolName[]
	const snapshotKeys = Object.keys(effectiveSnapshot) as ToolName[]
	if (currentKeys.length !== snapshotKeys.length) return true
	return currentKeys.some((key) => {
		const currentTool = current[key]
		const snapshotTool = effectiveSnapshot[key]
		if (!snapshotTool || !currentTool) return true
		return currentTool.attempts !== snapshotTool.attempts || currentTool.failures !== snapshotTool.failures
	})
}