/**
 * TelemetryService - Event tracking and analytics
 * Respects user privacy settings and can be disabled
 */

import { v4 as uuidv4 } from "uuid"
import type { TelemetryEvent, TelemetryEventType, TelemetrySettings } from "./types"

const MAX_QUEUE_SIZE = 100
const FLUSH_INTERVAL = 30000 // 30 seconds

export class TelemetryService {
	private static instance: TelemetryService
	private settings: TelemetrySettings
	private eventQueue: TelemetryEvent[] = []
	private flushTimeout: NodeJS.Timeout | null = null
	private listeners: Array<(event: TelemetryEvent) => void> = []

	private constructor() {
		this.settings = {
			enabled: false,
			sessionId: uuidv4(),
		}
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(): TelemetryService {
		if (!TelemetryService.instance) {
			TelemetryService.instance = new TelemetryService()
		}
		return TelemetryService.instance
	}

	/**
	 * Enable or disable telemetry
	 */
	setEnabled(enabled: boolean): void {
		this.settings.enabled = enabled

		if (enabled && !this.settings.anonymousId) {
			this.settings.anonymousId = uuidv4()
		}

		if (!enabled) {
			// Clear queue when disabled
			this.eventQueue = []
		}
	}

	/**
	 * Check if telemetry is enabled
	 */
	isEnabled(): boolean {
		return this.settings.enabled
	}

	/**
	 * Track an event
	 */
	track(type: TelemetryEventType, properties: Record<string, any> = {}): void {
		if (!this.settings.enabled) {
			return
		}

		const event: TelemetryEvent = {
			type,
			timestamp: Date.now(),
			properties: {
				...properties,
				anonymousId: this.settings.anonymousId,
				sessionId: this.settings.sessionId,
			},
		}

		this.eventQueue.push(event)

		// Trim queue if too large
		if (this.eventQueue.length > MAX_QUEUE_SIZE) {
			this.eventQueue = this.eventQueue.slice(-MAX_QUEUE_SIZE)
		}

		// Notify listeners
		this.listeners.forEach((listener) => listener(event))

		// Schedule flush
		this.scheduleFlush()
	}

	/**
	 * Track API request
	 */
	trackApiRequest(
		provider: string,
		model: string,
		promptTokens: number,
		completionTokens: number,
		durationMs: number,
		success: boolean,
		error?: string
	): void {
		this.track("api_request", {
			provider,
			model,
			promptTokens,
			completionTokens,
			totalTokens: promptTokens + completionTokens,
			durationMs,
			success,
			error,
		})
	}

	/**
	 * Track tool usage
	 */
	trackToolUse(toolName: string, mode: string, success: boolean, durationMs: number, error?: string): void {
		this.track("tool_used", {
			toolName,
			mode,
			success,
			durationMs,
			error,
		})
	}

	/**
	 * Track error
	 */
	trackError(errorType: string, errorMessage: string, stack?: string, context?: string): void {
		this.track("error_occurred", {
			errorType,
			errorMessage,
			stack,
			context,
		})
	}

	/**
	 * Add event listener
	 */
	addListener(listener: (event: TelemetryEvent) => void): void {
		this.listeners.push(listener)
	}

	/**
	 * Remove event listener
	 */
	removeListener(listener: (event: TelemetryEvent) => void): void {
		this.listeners = this.listeners.filter((l) => l !== listener)
	}

	/**
	 * Schedule a flush of the event queue
	 */
	private scheduleFlush(): void {
		if (this.flushTimeout) {
			return
		}

		this.flushTimeout = setTimeout(() => {
			this.flush()
		}, FLUSH_INTERVAL)
	}

	/**
	 * Flush the event queue (send events to backend)
	 * In this implementation, we just log them. In production, you'd send to an analytics service.
	 */
	async flush(): Promise<void> {
		if (this.flushTimeout) {
			clearTimeout(this.flushTimeout)
			this.flushTimeout = null
		}

		if (!this.settings.enabled || this.eventQueue.length === 0) {
			return
		}

		const eventsToFlush = [...this.eventQueue]
		this.eventQueue = []

		// Log events (in production, send to analytics backend)
		console.log(`[Telemetry] Flushing ${eventsToFlush.length} events`)

		// TODO: In production, send to analytics backend
		// await this.sendToBackend(eventsToFlush)
	}

	/**
	 * Get session statistics
	 */
	getSessionStats(): {
		totalEvents: number
		apiRequests: number
		toolUses: number
		errors: number
	} {
		const events = this.eventQueue
		return {
			totalEvents: events.length,
			apiRequests: events.filter((e) => e.type === "api_request").length,
			toolUses: events.filter((e) => e.type === "tool_used").length,
			errors: events.filter((e) => e.type === "error_occurred").length,
		}
	}

	/**
	 * Reset session (generate new session ID)
	 */
	resetSession(): void {
		this.settings.sessionId = uuidv4()
		this.eventQueue = []
	}

	/**
	 * Dispose the service
	 */
	async dispose(): Promise<void> {
		await this.flush()
		this.listeners = []
	}
}

/**
 * Convenience function to get telemetry instance
 */
export const telemetry = TelemetryService.getInstance()