"use strict";
/**
 * TelemetryService - Event tracking and analytics
 * Respects user privacy settings and can be disabled
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.telemetry = exports.TelemetryService = void 0;
const uuid_1 = require("uuid");
const MAX_QUEUE_SIZE = 100;
const FLUSH_INTERVAL = 30000; // 30 seconds
class TelemetryService {
    constructor() {
        this.eventQueue = [];
        this.flushTimeout = null;
        this.listeners = [];
        this.settings = {
            enabled: false,
            sessionId: (0, uuid_1.v4)(),
        };
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!TelemetryService.instance) {
            TelemetryService.instance = new TelemetryService();
        }
        return TelemetryService.instance;
    }
    /**
     * Enable or disable telemetry
     */
    setEnabled(enabled) {
        this.settings.enabled = enabled;
        if (enabled && !this.settings.anonymousId) {
            this.settings.anonymousId = (0, uuid_1.v4)();
        }
        if (!enabled) {
            // Clear queue when disabled
            this.eventQueue = [];
        }
    }
    /**
     * Check if telemetry is enabled
     */
    isEnabled() {
        return this.settings.enabled;
    }
    /**
     * Track an event
     */
    track(type, properties = {}) {
        if (!this.settings.enabled) {
            return;
        }
        const event = {
            type,
            timestamp: Date.now(),
            properties: {
                ...properties,
                anonymousId: this.settings.anonymousId,
                sessionId: this.settings.sessionId,
            },
        };
        this.eventQueue.push(event);
        // Trim queue if too large
        if (this.eventQueue.length > MAX_QUEUE_SIZE) {
            this.eventQueue = this.eventQueue.slice(-MAX_QUEUE_SIZE);
        }
        // Notify listeners
        this.listeners.forEach((listener) => listener(event));
        // Schedule flush
        this.scheduleFlush();
    }
    /**
     * Track API request
     */
    trackApiRequest(provider, model, promptTokens, completionTokens, durationMs, success, error) {
        this.track("api_request", {
            provider,
            model,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            durationMs,
            success,
            error,
        });
    }
    /**
     * Track tool usage
     */
    trackToolUse(toolName, mode, success, durationMs, error) {
        this.track("tool_used", {
            toolName,
            mode,
            success,
            durationMs,
            error,
        });
    }
    /**
     * Track error
     */
    trackError(errorType, errorMessage, stack, context) {
        this.track("error_occurred", {
            errorType,
            errorMessage,
            stack,
            context,
        });
    }
    /**
     * Add event listener
     */
    addListener(listener) {
        this.listeners.push(listener);
    }
    /**
     * Remove event listener
     */
    removeListener(listener) {
        this.listeners = this.listeners.filter((l) => l !== listener);
    }
    /**
     * Schedule a flush of the event queue
     */
    scheduleFlush() {
        if (this.flushTimeout) {
            return;
        }
        this.flushTimeout = setTimeout(() => {
            this.flush();
        }, FLUSH_INTERVAL);
    }
    /**
     * Flush the event queue (send events to backend)
     * In this implementation, we just log them. In production, you'd send to an analytics service.
     */
    async flush() {
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
            this.flushTimeout = null;
        }
        if (!this.settings.enabled || this.eventQueue.length === 0) {
            return;
        }
        const eventsToFlush = [...this.eventQueue];
        this.eventQueue = [];
        // Log events (in production, send to analytics backend)
        console.log(`[Telemetry] Flushing ${eventsToFlush.length} events`);
        // TODO: In production, send to analytics backend
        // await this.sendToBackend(eventsToFlush)
    }
    /**
     * Get session statistics
     */
    getSessionStats() {
        const events = this.eventQueue;
        return {
            totalEvents: events.length,
            apiRequests: events.filter((e) => e.type === "api_request").length,
            toolUses: events.filter((e) => e.type === "tool_used").length,
            errors: events.filter((e) => e.type === "error_occurred").length,
        };
    }
    /**
     * Reset session (generate new session ID)
     */
    resetSession() {
        this.settings.sessionId = (0, uuid_1.v4)();
        this.eventQueue = [];
    }
    /**
     * Dispose the service
     */
    async dispose() {
        await this.flush();
        this.listeners = [];
    }
}
exports.TelemetryService = TelemetryService;
/**
 * Convenience function to get telemetry instance
 */
exports.telemetry = TelemetryService.getInstance();
//# sourceMappingURL=TelemetryService.js.map