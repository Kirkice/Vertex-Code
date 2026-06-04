export { combineCommandSequences, COMMAND_OUTPUT_STRING } from "./combineCommandSequences"
export { combineApiRequests } from "./combineApiRequests"
export { getApiMetrics, hasTokenUsageChanged, hasToolUsageChanged } from "./getApiMetrics"
export type { ParsedApiReqStartedTextType } from "./getApiMetrics"

export function safeJsonParse<T>(str: string, fallback: T): T {
	try { return JSON.parse(str) } catch { return fallback }
}
