/**
 * Telemetry Service Types
 * Event tracking and analytics
 */

export type TelemetryEventType =
	| "extension_activated"
	| "extension_deactivated"
	| "conversation_started"
	| "conversation_completed"
	| "message_sent"
	| "message_received"
	| "tool_used"
	| "api_request"
	| "api_error"
	| "checkpoint_created"
	| "checkpoint_restored"
	| "mcp_server_connected"
	| "mcp_tool_called"
	| "error_occurred"

export interface TelemetryEvent {
	type: TelemetryEventType
	timestamp: number
	properties: Record<string, any>
}

export interface ApiRequestTelemetry {
	type: "api_request"
	properties: {
		provider: string
		model: string
		promptTokens: number
		completionTokens: number
		totalTokens: number
		durationMs: number
		success: boolean
		error?: string
	}
}

export interface ToolUseTelemetry {
	type: "tool_used"
	properties: {
		toolName: string
		mode: string
		success: boolean
		durationMs: number
		error?: string
	}
}

export interface ErrorTelemetry {
	type: "error_occurred"
	properties: {
		errorType: string
		errorMessage: string
		stack?: string
		context?: string
	}
}

export interface TelemetrySettings {
	enabled: boolean
	anonymousId?: string
	sessionId?: string
}