/**
 * MCP Service Types
 * Model Context Protocol integration types for Vertex AI
 */

export interface McpServerConfig {
	name: string
	type: "stdio" | "sse" | "streamable-http"
	command?: string
	args?: string[]
	env?: Record<string, string>
	url?: string
	disabled?: boolean
	timeout?: number
}

export interface McpTool {
	name: string
	description: string
	inputSchema: Record<string, any>
	enabled?: boolean
}

export interface McpResource {
	uri: string
	name: string
	description?: string
	mimeType?: string
}

export interface McpResourceTemplate {
	uriTemplate: string
	name: string
	description?: string
	mimeType?: string
}

export interface McpServer {
	name: string
	config: McpServerConfig
	status: "connected" | "disconnected" | "error" | "connecting"
	error?: string
	tools?: McpTool[]
	resources?: McpResource[]
	resourceTemplates?: McpResourceTemplate[]
}

export interface McpToolCallResponse {
	content: Array<{
		type: "text" | "image" | "resource"
		text?: string
		data?: string
		mimeType?: string
	}>
	isError?: boolean
}

export interface McpResourceResponse {
	contents: Array<{
		uri: string
		mimeType?: string
		text?: string
		blob?: string
	}>
}