/**
 * Task Router
 *
 * Selects the appropriate model for each execution task based on:
 * - Task kind and risk level
 * - File count and estimated diff size
 * - Budget pressure
 * - Historical failure count
 * - Provider availability
 *
 * Uses rule-based routing (not ML) for predictability and debuggability.
 */

import type { ExecTask, ModelPreference } from "@roo-code/types"

/**
 * Runtime signals for routing decisions
 */
export interface RuntimeSignals {
	budgetPressure: "low" | "medium" | "high"
	estimatedDiffLines: number
	historicalFailureCount: number
	requiresArchitectureDecision: boolean
	requiresBehaviorPreservation: boolean
	availableProviders: string[]
}

/**
 * Default runtime signals
 */
const DEFAULT_SIGNALS: RuntimeSignals = {
	budgetPressure: "low",
	estimatedDiffLines: 0,
	historicalFailureCount: 0,
	requiresArchitectureDecision: false,
	requiresBehaviorPreservation: false,
	availableProviders: ["codex", "deepseek", "qwen"],
}

/**
 * Route table entry
 */
interface RouteEntry {
	matches: (task: ExecTask, signals: RuntimeSignals) => boolean
	preferred: ModelPreference
	fallback: ModelPreference
	reason: string
}

/**
 * Default route table (priority order - first match wins)
 */
const DEFAULT_ROUTE_TABLE: RouteEntry[] = [
	{
		matches: (task) => task.riskLevel === "high",
		preferred: { provider: "codex", reasoningEffort: "high" },
		fallback: { provider: "claude", reasoningEffort: "high" },
		reason: "High-risk task requires Codex",
	},
	{
		matches: (task) => task.allowedWritePaths.length >= 3,
		preferred: { provider: "codex", reasoningEffort: "high" },
		fallback: { provider: "claude", reasoningEffort: "high" },
		reason: "Multi-file refactoring requires Codex",
	},
	{
		matches: (_task, signals) => signals.historicalFailureCount >= 2,
		preferred: { provider: "codex", reasoningEffort: "high" },
		fallback: { provider: "claude", reasoningEffort: "high" },
		reason: "Repeated failures - escalating to Codex",
	},
	{
		matches: (_task, signals) => signals.requiresArchitectureDecision,
		preferred: { provider: "codex", reasoningEffort: "high" },
		fallback: { provider: "claude", reasoningEffort: "medium" },
		reason: "Architecture decision requires Codex",
	},
	{
		matches: (task, signals) => signals.budgetPressure === "high" && task.riskLevel === "low",
		preferred: { provider: "deepseek", reasoningEffort: "low" },
		fallback: { provider: "qwen", reasoningEffort: "low" },
		reason: "Budget pressure - using cheapest model for low-risk task",
	},
	{
		matches: (task, signals) => task.allowedWritePaths.length === 1 && signals.estimatedDiffLines < 150,
		preferred: { provider: "deepseek", reasoningEffort: "medium" },
		fallback: { provider: "qwen", reasoningEffort: "medium" },
		reason: "Single file small diff - using DeepSeek",
	},
	{
		matches: (task) => task.kind === "repair",
		preferred: { provider: "deepseek", reasoningEffort: "medium" },
		fallback: { provider: "qwen", reasoningEffort: "medium" },
		reason: "Repair task - using cost-effective model",
	},
	{
		matches: () => true,
		preferred: { provider: "qwen", reasoningEffort: "medium" },
		fallback: { provider: "deepseek", reasoningEffort: "medium" },
		reason: "Default route - using Qwen",
	},
]

/**
 * Routing result
 */
export interface RoutingResult {
	selectedModel: ModelPreference
	fallbackModel: ModelPreference
	reason: string
	isFallback: boolean
}

/**
 * Task Router
 *
 * Rule-based router that selects models for execution tasks.
 * Supports custom route tables for extensibility.
 */
export class TaskRouter {
	private routeTable: RouteEntry[]
	private availableProviders: Set<string>

	constructor(customRouteTable?: RouteEntry[], availableProviders?: string[]) {
		this.routeTable = customRouteTable ?? DEFAULT_ROUTE_TABLE
		this.availableProviders = new Set(availableProviders ?? DEFAULT_SIGNALS.availableProviders)
	}

	/**
	 * Route a task to the appropriate model
	 */
	route(task: ExecTask, signals?: Partial<RuntimeSignals>): RoutingResult {
		const mergedSignals: RuntimeSignals = { ...DEFAULT_SIGNALS, ...signals }

		for (const entry of this.routeTable) {
			if (entry.matches(task, mergedSignals)) {
				const canUsePreferred = this.isProviderAvailable(entry.preferred.provider)
				if (canUsePreferred) {
					return {
						selectedModel: entry.preferred,
						fallbackModel: entry.fallback,
						reason: entry.reason,
						isFallback: false,
					}
				}

				const canUseFallback = this.isProviderAvailable(entry.fallback.provider)
				if (canUseFallback) {
					return {
						selectedModel: entry.fallback,
						fallbackModel: entry.preferred,
						reason: `${entry.reason} (fallback - preferred unavailable)`,
						isFallback: true,
					}
				}

				// Neither available - use first available provider
				const firstAvailable = this.getFirstAvailableProvider()
				if (firstAvailable) {
					return {
						selectedModel: { provider: firstAvailable as ModelPreference["provider"], reasoningEffort: "medium" },
						fallbackModel: entry.fallback,
						reason: `${entry.reason} (using first available provider)`,
						isFallback: true,
					}
				}

				throw new Error(`No available providers for task ${task.taskId}`)
			}
		}

		// Should never reach here (default route matches all)
		throw new Error(`No route matched for task ${task.taskId}`)
	}

	/**
	 * Check if a provider is available
	 */
	private isProviderAvailable(provider: string): boolean {
		if (provider === "auto") return true
		return this.availableProviders.has(provider)
	}

	/**
	 * Get first available provider
	 */
	private getFirstAvailableProvider(): string | null {
		const providers = Array.from(this.availableProviders)
		return providers.length > 0 ? providers[0] : null
	}

	/**
	 * Update available providers
	 */
	setAvailableProviders(providers: string[]): void {
		this.availableProviders = new Set(providers)
	}

	/**
	 * Add a custom route (prepend for highest priority)
	 */
	addRoute(route: RouteEntry): void {
		this.routeTable.unshift(route)
	}

	/**
	 * Get current route table (for debugging)
	 */
	getRouteTable(): ReadonlyArray<RouteEntry> {
		return this.routeTable
	}
}

/**
 * Create a router with default configuration
 */
export function createDefaultRouter(availableProviders?: string[]): TaskRouter {
	return new TaskRouter(undefined, availableProviders)
}