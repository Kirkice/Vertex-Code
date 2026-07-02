/**
 * Graphics Provider Registry
 *
 * Central registry for managing graphics capture providers.
 * Handles provider registration, discovery, selection, and capability matching.
 *
 * Key behaviors:
 * - No default provider is preset
 * - User-selected provider takes priority
 * - When no provider is selected, candidates are matched by required capabilities
 * - Single provider per session constraint (Phase 1-4)
 *
 * @module graphics-provider/GraphicsProviderRegistry
 */

import type { GraphicsCaptureProvider } from "./GraphicsCaptureProvider"
import type {
	GraphicsProviderCapabilities,
	GraphicsProviderId,
	GraphicsProviderStatusInfo,
} from "./GraphicsProviderTypes"
import { checkCapabilities } from "./GraphicsProviderTypes"
import { GraphicsProviderError } from "./GraphicsProviderError"

/**
 * Interface for the graphics provider registry.
 *
 * The registry is the single entry point for discovering and selecting
 * graphics capture providers. Workflow and UI layers should use the
 * registry rather than accessing providers directly.
 */
export interface IGraphicsProviderRegistry {
	/**
	 * List all registered providers (available or not).
	 */
	listProviders(): Promise<GraphicsCaptureProvider[]>

	/**
	 * Get only the providers that are currently available.
	 */
	getAvailableProviders(): Promise<GraphicsCaptureProvider[]>

	/**
	 * Get the currently selected provider for this session.
	 *
	 * Returns null if no provider has been selected and no
	 * auto-matched provider is available.
	 */
	getSelectedProvider(): Promise<GraphicsCaptureProvider | null>

	/**
	 * Find providers that satisfy the given capability requirements.
	 *
	 * @param required - Partial capabilities that must be supported
	 * @returns List of providers matching all required capabilities
	 */
	getAutoMatchProviders(
		required: Partial<GraphicsProviderCapabilities>,
	): Promise<GraphicsCaptureProvider[]>

	/**
	 * Get a specific provider by its ID.
	 *
	 * @param id - The provider ID to look up
	 * @returns The provider, or null if not found
	 */
	getProviderById(id: GraphicsProviderId): Promise<GraphicsCaptureProvider | null>

	/**
	 * Explicitly select a provider for the current session.
	 *
	 * @param id - The provider ID to select
	 * @throws GraphicsProviderError if the provider is not found or not available
	 */
	selectProvider(id: GraphicsProviderId): Promise<void>

	/**
	 * Clear the current provider selection.
	 */
	clearSelection(): void

	/**
	 * Register a new provider with the registry.
	 *
	 * @param provider - The provider to register
	 */
	registerProvider(provider: GraphicsCaptureProvider): void

	/**
	 * Unregister a provider by its ID.
	 *
	 * @param id - The provider ID to remove
	 */
	unregisterProvider(id: GraphicsProviderId): void

	/**
	 * Get status information for all registered providers.
	 */
	getAllStatuses(): Promise<GraphicsProviderStatusInfo[]>

	/**
	 * Perform a preflight check: verify that the selected (or auto-matched)
	 * provider satisfies the required capabilities for a workflow.
	 *
	 * @param required - The capabilities required by the workflow
	 * @returns The provider to use, or throws if no suitable provider is found
	 * @throws GraphicsProviderError if no provider satisfies the requirements
	 */
	preflightCheck(
		required: Partial<GraphicsProviderCapabilities>,
	): Promise<GraphicsCaptureProvider>
}

/**
 * Default implementation of the graphics provider registry.
 */
export class GraphicsProviderRegistry implements IGraphicsProviderRegistry {
	private providers = new Map<GraphicsProviderId, GraphicsCaptureProvider>()
	private selectedProviderId: GraphicsProviderId | null = null

	registerProvider(provider: GraphicsCaptureProvider): void {
		this.providers.set(provider.id, provider)
	}

	unregisterProvider(id: GraphicsProviderId): void {
		this.providers.delete(id)
		if (this.selectedProviderId === id) {
			this.selectedProviderId = null
		}
	}

	async listProviders(): Promise<GraphicsCaptureProvider[]> {
		return Array.from(this.providers.values())
	}

	async getAvailableProviders(): Promise<GraphicsCaptureProvider[]> {
		const all = Array.from(this.providers.values())
		const results = await Promise.all(
			all.map(async (p) => ({ provider: p, available: await p.isAvailable() })),
		)
		return results.filter((r) => r.available).map((r) => r.provider)
	}

	async getSelectedProvider(): Promise<GraphicsCaptureProvider | null> {
		if (this.selectedProviderId) {
			const provider = this.providers.get(this.selectedProviderId)
			if (provider && (await provider.isAvailable())) {
				return provider
			}
			// Selected provider is no longer available
			this.selectedProviderId = null
		}

		// No explicit selection — return null so callers can fall back to auto-matching
		return null
	}

	async getAutoMatchProviders(
		required: Partial<GraphicsProviderCapabilities>,
	): Promise<GraphicsCaptureProvider[]> {
		const available = await this.getAvailableProviders()
		const matched: GraphicsCaptureProvider[] = []

		for (const provider of available) {
			const caps = await provider.getCapabilities()
			const { satisfied } = checkCapabilities(caps, required)
			if (satisfied) {
				matched.push(provider)
			}
		}

		return matched
	}

	async getProviderById(id: GraphicsProviderId): Promise<GraphicsCaptureProvider | null> {
		return this.providers.get(id) ?? null
	}

	async selectProvider(id: GraphicsProviderId): Promise<void> {
		const provider = this.providers.get(id)
		if (!provider) {
			throw new GraphicsProviderError(
				`Provider not found: ${id}`,
				"PROVIDER_NOT_FOUND",
			)
		}

		const available = await provider.isAvailable()
		if (!available) {
			throw new GraphicsProviderError(
				`Provider is not available: ${provider.displayName}`,
				"PROVIDER_UNAVAILABLE",
			)
		}

		this.selectedProviderId = id
	}

	clearSelection(): void {
		this.selectedProviderId = null
	}

	async getAllStatuses(): Promise<GraphicsProviderStatusInfo[]> {
		const all = Array.from(this.providers.values())
		return Promise.all(all.map((p) => p.getStatus()))
	}

	async preflightCheck(
		required: Partial<GraphicsProviderCapabilities>,
	): Promise<GraphicsCaptureProvider> {
		// 1. If user explicitly selected a provider, use it (and fail if it doesn't match)
		if (this.selectedProviderId) {
			const selected = this.providers.get(this.selectedProviderId)
			if (selected && (await selected.isAvailable())) {
				const caps = await selected.getCapabilities()
				const { satisfied, missing } = checkCapabilities(caps, required)
				if (satisfied) {
					return selected
				}
				throw new GraphicsProviderError(
					`Selected provider "${selected.displayName}" is missing capabilities: ${missing.join(", ")}`,
					"CAPABILITY_MISMATCH",
					{ missing, providerId: selected.id },
				)
			}
			// Explicitly selected provider is no longer available
			this.selectedProviderId = null
		}

		// 2. No explicit selection — try auto-matching by required capabilities
		const matched = await this.getAutoMatchProviders(required)
		if (matched.length > 0) {
			return matched[0]
		}

		// 3. No provider satisfies the requirements
		throw new GraphicsProviderError(
			"No graphics provider available with the required capabilities. " +
				"Please install or enable a graphics capture tool (e.g., RenderDoc for VS Code).",
			"NO_SUITABLE_PROVIDER",
			{ required },
		)
	}
}
