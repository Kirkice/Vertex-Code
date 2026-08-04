import { describe, expect, it, vi } from "vitest"
import type { GraphicsAssetProvider } from "../GraphicsAssetProvider"
import { GraphicsAssetProviderRegistry } from "../GraphicsAssetProviderRegistry"
import type {
	GraphicsAssetProviderCapabilities,
	GraphicsAssetProviderStatus,
} from "../GraphicsAssetTypes"

const capabilities: GraphicsAssetProviderCapabilities = {
	loadArtifact: true,
	assetInventory: true,
	texture: true,
	mesh: true,
	material: true,
	renderer: true,
	memory: true,
	dependencies: true,
	serializedComponent: true,
	audit: true,
}

const status: GraphicsAssetProviderStatus = {
	providerId: "asset-studio-mcp",
	providerName: "AssetStudio MCP",
	availability: "available",
	health: "healthy",
	diagnostics: [],
	checkedAt: "2026-08-03T00:00:00.000Z",
}

function createProvider(
	overrides: Partial<GraphicsAssetProvider> = {},
): GraphicsAssetProvider {
	return {
		id: "asset-studio-mcp",
		displayName: "AssetStudio MCP",
		kind: "mcp",
		getStatus: vi.fn(async () => status),
		isAvailable: vi.fn(async () => true),
		getCapabilities: vi.fn(async () => capabilities),
		loadArtifact: vi.fn(),
		getAssetInventory: vi.fn(),
		analyzeTexture: vi.fn(),
		analyzeMesh: vi.fn(),
		getMaterialContract: vi.fn(),
		getRendererConfiguration: vi.fn(),
		getBuildAssetMemory: vi.fn(),
		getBundleDependencies: vi.fn(),
		readSerializedComponent: vi.fn(),
		...overrides,
	}
}

describe("GraphicsAssetProviderRegistry", () => {
	it("selects the first provider and replaces providers by stable id", () => {
		const registry = new GraphicsAssetProviderRegistry()
		const first = createProvider()
		const replacement = createProvider({ displayName: "Replacement" })
		const second = createProvider({ id: "other-provider", displayName: "Other" })

		registry.registerProvider(first)
		registry.registerProvider(second)
		registry.registerProvider(replacement)

		expect(registry.getProvider()).toBe(replacement)
		expect(registry.listProviders()).toEqual([replacement, second])
	})

	it("moves selection to the next provider when the selected provider is removed", () => {
		const registry = new GraphicsAssetProviderRegistry()
		const first = createProvider()
		const second = createProvider({ id: "other-provider" })

		registry.registerProvider(first)
		registry.registerProvider(second)
		registry.unregisterProvider(first.id)

		expect(registry.getProvider()).toBe(second)
		registry.unregisterProvider(second.id)
		expect(registry.getProvider()).toBeNull()
	})

	it("returns all statuses and tolerates capability lookup failures", async () => {
		const registry = new GraphicsAssetProviderRegistry()
		const healthy = createProvider()
		const failing = createProvider({
			id: "failing-provider",
			getCapabilities: vi.fn(async () => {
				throw new Error("capability probe failed")
			}),
		})

		registry.registerProvider(healthy)
		registry.registerProvider(failing)

		expect(await registry.getAllStatuses()).toEqual([status, status])
		expect(await registry.getCapabilities(healthy.id)).toBe(capabilities)
		expect(await registry.getCapabilities(failing.id)).toBeNull()
		expect(await registry.getCapabilities("missing")).toBeNull()
	})
})
