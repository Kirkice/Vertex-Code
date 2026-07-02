/**
 * Graphics Provider Error
 *
 * Unified error class for graphics provider operations.
 * Provides structured error codes and contextual metadata
 * for better error handling and user-facing messages.
 *
 * @module graphics-provider/GraphicsProviderError
 */

/**
 * Error codes for graphics provider operations.
 */
export type GraphicsProviderErrorCode =
	| "PROVIDER_NOT_FOUND" // Provider ID does not exist in registry
	| "PROVIDER_UNAVAILABLE" // Provider exists but is not running/accessible
	| "NO_CAPTURE_OPEN" // Provider is running but no capture is loaded
	| "CAPABILITY_MISMATCH" // Provider lacks required capabilities
	| "NO_SUITABLE_PROVIDER" // No provider satisfies the requirements
	| "TOOL_CALL_FAILED" // Underlying MCP/extension tool call failed
	| "TIMEOUT" // Provider did not respond in time
	| "UNKNOWN" // Unclassified error

/**
 * Additional context attached to a provider error.
 */
export interface GraphicsProviderErrorContext {
	/** Provider ID, if applicable */
	providerId?: string
	/** List of missing capabilities, if applicable */
	missing?: string[]
	/** Required capabilities that were not met */
	required?: Record<string, boolean>
	/** Original error, if wrapping another error */
	cause?: Error
	/** Tool name that failed, if applicable */
	toolName?: string
}

/**
 * Structured error for graphics provider operations.
 *
 * Usage:
 * ```ts
 * throw new GraphicsProviderError(
 *   "RenderDoc MCP is not responding",
 *   "PROVIDER_UNAVAILABLE",
 *   { providerId: "renderdoc-vscode-mcp" }
 * )
 * ```
 */
export class GraphicsProviderError extends Error {
	public readonly code: GraphicsProviderErrorCode
	public readonly context: GraphicsProviderErrorContext

	constructor(
		message: string,
		code: GraphicsProviderErrorCode,
		context: GraphicsProviderErrorContext = {},
	) {
		super(message)
		this.name = "GraphicsProviderError"
		this.code = code
		this.context = context

		// Preserve stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, GraphicsProviderError)
		}
	}

	/**
	 * Get a user-friendly message suitable for display in the UI.
	 */
	getUserMessage(): string {
		switch (this.code) {
			case "PROVIDER_NOT_FOUND":
				return "The selected graphics provider is not registered. Please check your configuration."
			case "PROVIDER_UNAVAILABLE":
				return "The graphics provider is not available. Please ensure the tool is installed and running."
			case "NO_CAPTURE_OPEN":
				return "No capture is currently open. Please open a capture in your graphics tool first."
			case "CAPABILITY_MISMATCH":
				return `The current graphics provider does not support this operation. Missing: ${this.context.missing?.join(", ") ?? "unknown capabilities"}`
			case "NO_SUITABLE_PROVIDER":
				return "No graphics provider is available. Please install a graphics capture tool (e.g., RenderDoc for VS Code)."
			case "TOOL_CALL_FAILED":
				return `Graphics tool call failed${this.context.toolName ? `: ${this.context.toolName}` : ""}.`
			case "TIMEOUT":
				return "The graphics provider did not respond in time. Please try again."
			default:
				return this.message
		}
	}
}
