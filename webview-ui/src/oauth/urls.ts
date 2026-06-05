import { Package } from "@vertex/package"

export function getCallbackUrl(provider: string, uriScheme?: string) {
	return encodeURIComponent(`${uriScheme || "vscode"}://${Package.publisher}.${Package.name}/${provider}`)
}

export function getOpenRouterAuthUrl(uriScheme?: string) {
	return `https://openrouter.ai/auth?callback_url=${getCallbackUrl("openrouter", uriScheme)}`
}

export function getRequestyAuthUrl(uriScheme?: string) {
	return `https://app.requesty.ai/oauth/authorize?callback_url=${getCallbackUrl("requesty", uriScheme)}`
}

const VERTEX_AI_DEFAULT_BASE_URL = "https://www.vertexai.dev"

export function getVertexAIAuthUrl(uriScheme?: string, baseUrl?: string, deviceName?: string) {
	const resolvedBaseUrl = baseUrl || VERTEX_AI_DEFAULT_BASE_URL
	const callbackUri = getCallbackUrl("auth-callback", uriScheme)
	const resolvedDeviceName = encodeURIComponent(deviceName || "VS Code")
	const editor = encodeURIComponent("VS Code")
	const version = Package.version
	return `${resolvedBaseUrl}/dashboard/connect?device=${resolvedDeviceName}&editor=${editor}&version=${version}&callback_uri=${callbackUri}`
}
