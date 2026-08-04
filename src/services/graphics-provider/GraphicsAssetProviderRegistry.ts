/** Registry for asset-analysis providers, separate from capture providers. */

import type { GraphicsAssetProvider } from "./GraphicsAssetProvider"
import type {
	GraphicsAssetProviderCapabilities,
	GraphicsAssetProviderStatus,
} from "./GraphicsAssetTypes"

export interface IGraphicsAssetProviderRegistry {
	registerProvider(provider: GraphicsAssetProvider): void
	unregisterProvider(id: string): void
	getProvider(id?: string): GraphicsAssetProvider | null
	listProviders(): GraphicsAssetProvider[]
	getAllStatuses(): Promise<GraphicsAssetProviderStatus[]>
	getCapabilities(providerId?: string): Promise<GraphicsAssetProviderCapabilities | null>
}

export class GraphicsAssetProviderRegistry implements IGraphicsAssetProviderRegistry {
	private readonly providers = new Map<string, GraphicsAssetProvider>()
	private selectedProviderId: string | undefined

	registerProvider(provider: GraphicsAssetProvider): void {
		this.providers.set(provider.id, provider)
		if (!this.selectedProviderId) this.selectedProviderId = provider.id
	}

	unregisterProvider(id: string): void {
		this.providers.delete(id)
		if (this.selectedProviderId === id) {
			this.selectedProviderId = this.providers.keys().next().value
		}
	}

	getProvider(id?: string): GraphicsAssetProvider | null {
		return this.providers.get(id ?? this.selectedProviderId ?? "") ?? null
	}

	listProviders(): GraphicsAssetProvider[] {
		return [...this.providers.values()]
	}

	async getAllStatuses(): Promise<GraphicsAssetProviderStatus[]> {
		return Promise.all(this.listProviders().map((provider) => provider.getStatus()))
	}

	async getCapabilities(providerId?: string): Promise<GraphicsAssetProviderCapabilities | null> {
		const provider = this.getProvider(providerId)
		if (!provider) return null
		try {
			return await provider.getCapabilities()
		} catch {
			return null
		}
	}
}
