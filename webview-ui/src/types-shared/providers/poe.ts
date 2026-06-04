// Stub: ai-sdk-provider-poe is not available in webview
export const poeDefaultModelId = "claude-3-5-sonnet-20241022"
export const POE_DEFAULT_BASE_URL = "https://api.poe.com"
export interface PoeDefaultModelInfo { id: string; name: string }

export function getPoeDefaultModelInfo(): PoeDefaultModelInfo {
	return { id: poeDefaultModelId, name: "Claude 3.5 Sonnet" }
}