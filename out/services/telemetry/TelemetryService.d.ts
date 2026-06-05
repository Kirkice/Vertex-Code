/**
 * TelemetryService - Event tracking and analytics
 * Respects user privacy settings and can be disabled
 */
import type { TelemetryEvent, TelemetryEventType } from "./types";
export declare class TelemetryService {
    private static instance;
    private settings;
    private eventQueue;
    private flushTimeout;
    private listeners;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): TelemetryService;
    /**
     * Enable or disable telemetry
     */
    setEnabled(enabled: boolean): void;
    /**
     * Check if telemetry is enabled
     */
    isEnabled(): boolean;
    /**
     * Track an event
     */
    track(type: TelemetryEventType, properties?: Record<string, any>): void;
    /**
     * Track API request
     */
    trackApiRequest(provider: string, model: string, promptTokens: number, completionTokens: number, durationMs: number, success: boolean, error?: string): void;
    /**
     * Track tool usage
     */
    trackToolUse(toolName: string, mode: string, success: boolean, durationMs: number, error?: string): void;
    /**
     * Track error
     */
    trackError(errorType: string, errorMessage: string, stack?: string, context?: string): void;
    /**
     * Add event listener
     */
    addListener(listener: (event: TelemetryEvent) => void): void;
    /**
     * Remove event listener
     */
    removeListener(listener: (event: TelemetryEvent) => void): void;
    /**
     * Schedule a flush of the event queue
     */
    private scheduleFlush;
    /**
     * Flush the event queue (send events to backend)
     * In this implementation, we just log them. In production, you'd send to an analytics service.
     */
    flush(): Promise<void>;
    /**
     * Get session statistics
     */
    getSessionStats(): {
        totalEvents: number;
        apiRequests: number;
        toolUses: number;
        errors: number;
    };
    /**
     * Reset session (generate new session ID)
     */
    resetSession(): void;
    /**
     * Dispose the service
     */
    dispose(): Promise<void>;
}
/**
 * Convenience function to get telemetry instance
 */
export declare const telemetry: TelemetryService;
//# sourceMappingURL=TelemetryService.d.ts.map