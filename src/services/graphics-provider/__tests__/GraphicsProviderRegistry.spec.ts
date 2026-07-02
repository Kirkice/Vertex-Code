/**
 * GraphicsProviderRegistry Unit Tests
 *
 * @module graphics-provider/__tests__/GraphicsProviderRegistry.spec.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { GraphicsProviderRegistry } from "../GraphicsProviderRegistry"
import type { GraphicsCaptureProvider } from "../GraphicsCaptureProvider"

// Mock provider factory
const createMockProvider = (
	id: string,
	displayName: string,
	available: boolean = true,
	capabilities: Record<string, boolean> = {},
): GraphicsCaptureProvider => ({
	id,
	displayName,
	kind: "mcp",
	isAvailable: vi.fn().mockResolvedValue(available),
	getStatus: vi.fn().mockResolvedValue({
		status: available ? "available" : "unavailable",
		providerId: id,
		providerName: displayName,
	}),
	getCapabilities: vi.fn().mockResolvedValue({
		frameSummary: capabilities.frameSummary ?? true,
		selectionContext: capabilities.selectionContext ?? true,
		eventDetails: capabilities.eventDetails ?? true,
		pipelineState: capabilities.pipelineState ?? true,
		shaderInfo: capabilities.shaderInfo ?? true,
		shaderSource: capabilities.shaderSource ?? true,
		meshData: capabilities.meshData ?? true,
		resourceDetail: capabilities.resourceDetail ?? true,
		textureData: capabilities.textureData ?? true,
		bufferData: capabilities.bufferData ?? true,
		passGraph: capabilities.passGraph ?? true,
		projectMapping: capabilities.projectMapping ?? true,
		captureDiff: capabilities.captureDiff ?? true,
	}),
	openCurrentCapture: vi.fn().mockResolvedValue({ success: true }),
	getFrameSummary: vi.fn().mockResolvedValue({ success: true }),
	getSelectionContext: vi.fn().mockResolvedValue({ success: true }),
	getEventDetails: vi.fn().mockResolvedValue({ success: true }),
	getPipelineState: vi.fn().mockResolvedValue({ success: true }),
	getShaderInfo: vi.fn().mockResolvedValue({ success: true }),
	findProjectImplementation: vi.fn().mockResolvedValue({ success: true }),
})

describe("GraphicsProviderRegistry", () => {
	let registry: GraphicsProviderRegistry

	beforeEach(() => {
		registry = new GraphicsProviderRegistry()
	})

	describe("registerProvider", () => {
		it("should register a provider", () => {
			const provider = createMockProvider("test-1", "Test Provider 1")
			registry.registerProvider(provider)

			expect(registry.listProviders()).resolves.toHaveLength(1)
		})

		it("should register multiple providers", () => {
			const provider1 = createMockProvider("test-1", "Test Provider 1")
			const provider2 = createMockProvider("test-2", "Test Provider 2")

			registry.registerProvider(provider1)
			registry.registerProvider(provider2)

			expect(registry.listProviders()).resolves.toHaveLength(2)
		})

		it("should replace provider with same ID", async () => {
			const provider1 = createMockProvider("test-1", "Test Provider 1")
			const provider2 = createMockProvider("test-1", "Test Provider 1 Updated")

			registry.registerProvider(provider1)
			registry.registerProvider(provider2)

			const providers = await registry.listProviders()
			expect(providers).toHaveLength(1)
			expect(providers[0].displayName).toBe("Test Provider 1 Updated")
		})
	})

	describe("unregisterProvider", () => {
		it("should unregister a provider by ID", async () => {
			const provider = createMockProvider("test-1", "Test Provider 1")
			registry.registerProvider(provider)

			registry.unregisterProvider("test-1")

			const providers = await registry.listProviders()
			expect(providers).toHaveLength(0)
		})

		it("should not throw when unregistering non-existent provider", () => {
			expect(() => registry.unregisterProvider("non-existent")).not.toThrow()
		})

		it("should clear selection if unregistered provider was selected", async () => {
			const provider = createMockProvider("test-1", "Test Provider 1")
			registry.registerProvider(provider)
			await registry.selectProvider("test-1")

			registry.unregisterProvider("test-1")

			const selected = await registry.getSelectedProvider()
			expect(selected).toBeNull()
		})
	})

	describe("listProviders", () => {
		it("should return empty array when no providers registered", async () => {
			const providers = await registry.listProviders()
			expect(providers).toEqual([])
		})

		it("should return all registered providers", async () => {
			const provider1 = createMockProvider("test-1", "Test Provider 1")
			const provider2 = createMockProvider("test-2", "Test Provider 2")

			registry.registerProvider(provider1)
			registry.registerProvider(provider2)

			const providers = await registry.listProviders()
			expect(providers).toHaveLength(2)
			expect(providers.map((p) => p.id)).toContain("test-1")
			expect(providers.map((p) => p.id)).toContain("test-2")
		})
	})

	describe("getAvailableProviders", () => {
		it("should return only available providers", async () => {
			const availableProvider = createMockProvider("available", "Available", true)
			const unavailableProvider = createMockProvider("unavailable", "Unavailable", false)

			registry.registerProvider(availableProvider)
			registry.registerProvider(unavailableProvider)

			const available = await registry.getAvailableProviders()
			expect(available).toHaveLength(1)
			expect(available[0].id).toBe("available")
		})

		it("should return empty array when no providers are available", async () => {
			const unavailableProvider = createMockProvider("unavailable", "Unavailable", false)
			registry.registerProvider(unavailableProvider)

			const available = await registry.getAvailableProviders()
			expect(available).toHaveLength(0)
		})
	})

	describe("getSelectedProvider", () => {
		it("should return null when no provider is selected", async () => {
			const selected = await registry.getSelectedProvider()
			expect(selected).toBeNull()
		})

		it("should return selected provider", async () => {
			const provider = createMockProvider("test-1", "Test Provider 1")
			registry.registerProvider(provider)
			await registry.selectProvider("test-1")

			const selected = await registry.getSelectedProvider()
			expect(selected).not.toBeNull()
			expect(selected!.id).toBe("test-1")
		})

		it("should return null if selected provider becomes unavailable", async () => {
			const provider = createMockProvider("test-1", "Test Provider 1", true)
			registry.registerProvider(provider)
			await registry.selectProvider("test-1")

			// Make provider unavailable
			vi.mocked(provider.isAvailable).mockResolvedValue(false)

			const selected = await registry.getSelectedProvider()
			expect(selected).toBeNull()
		})
	})

	describe("selectProvider", () => {
		it("should select an available provider", async () => {
			const provider = createMockProvider("test-1", "Test Provider 1")
			registry.registerProvider(provider)

			await registry.selectProvider("test-1")

			const selected = await registry.getSelectedProvider()
			expect(selected!.id).toBe("test-1")
		})

		it("should throw when selecting non-existent provider", async () => {
			await expect(registry.selectProvider("non-existent")).rejects.toThrow()
		})

		it("should throw when selecting unavailable provider", async () => {
			const provider = createMockProvider("test-1", "Test Provider 1", false)
			registry.registerProvider(provider)

			await expect(registry.selectProvider("test-1")).rejects.toThrow()
		})
	})

	describe("clearSelection", () => {
		it("should clear the current selection", async () => {
			const provider = createMockProvider("test-1", "Test Provider 1")
			registry.registerProvider(provider)
			await registry.selectProvider("test-1")

			registry.clearSelection()

			const selected = await registry.getSelectedProvider()
			expect(selected).toBeNull()
		})
	})

	describe("getProviderById", () => {
		it("should return provider by ID", async () => {
			const provider = createMockProvider("test-1", "Test Provider 1")
			registry.registerProvider(provider)

			const found = await registry.getProviderById("test-1")
			expect(found).not.toBeNull()
			expect(found!.id).toBe("test-1")
		})

		it("should return null for non-existent ID", async () => {
			const found = await registry.getProviderById("non-existent")
			expect(found).toBeNull()
		})
	})

	describe("getAutoMatchProviders", () => {
		it("should return providers matching required capabilities", async () => {
			const fullProvider = createMockProvider("full", "Full Provider", true, {
				frameSummary: true,
				shaderInfo: true,
			})
			const partialProvider = createMockProvider("partial", "Partial Provider", true, {
				frameSummary: true,
				shaderInfo: false,
			})

			registry.registerProvider(fullProvider)
			registry.registerProvider(partialProvider)

			const matched = await registry.getAutoMatchProviders({
				frameSummary: true,
				shaderInfo: true,
			})

			expect(matched).toHaveLength(1)
			expect(matched[0].id).toBe("full")
		})

		it("should return all available providers when no capabilities required", async () => {
			const provider1 = createMockProvider("test-1", "Test Provider 1")
			const provider2 = createMockProvider("test-2", "Test Provider 2")

			registry.registerProvider(provider1)
			registry.registerProvider(provider2)

			const matched = await registry.getAutoMatchProviders({})
			expect(matched).toHaveLength(2)
		})

		it("should not include unavailable providers", async () => {
			const availableProvider = createMockProvider("available", "Available", true)
			const unavailableProvider = createMockProvider("unavailable", "Unavailable", false)

			registry.registerProvider(availableProvider)
			registry.registerProvider(unavailableProvider)

			const matched = await registry.getAutoMatchProviders({ frameSummary: true })
			expect(matched).toHaveLength(1)
			expect(matched[0].id).toBe("available")
		})
	})

	describe("getAllStatuses", () => {
		it("should return status for all providers", async () => {
			const provider1 = createMockProvider("test-1", "Test Provider 1", true)
			const provider2 = createMockProvider("test-2", "Test Provider 2", false)

			registry.registerProvider(provider1)
			registry.registerProvider(provider2)

			const statuses = await registry.getAllStatuses()
			expect(statuses).toHaveLength(2)
		})

		it("should return empty array when no providers registered", async () => {
			const statuses = await registry.getAllStatuses()
			expect(statuses).toEqual([])
		})
	})

	describe("preflightCheck", () => {
		it("should return selected provider if it meets requirements", async () => {
			const provider = createMockProvider("test-1", "Test Provider 1", true, {
				frameSummary: true,
				shaderInfo: true,
			})
			registry.registerProvider(provider)
			await registry.selectProvider("test-1")

			const result = await registry.preflightCheck({
				frameSummary: true,
				shaderInfo: true,
			})

			expect(result.id).toBe("test-1")
		})

		it("should auto-select provider if none selected", async () => {
			const provider = createMockProvider("test-1", "Test Provider 1", true, {
				frameSummary: true,
			})
			registry.registerProvider(provider)

			const result = await registry.preflightCheck({ frameSummary: true })
			expect(result.id).toBe("test-1")
		})

		it("should throw when no provider meets requirements", async () => {
			const provider = createMockProvider("test-1", "Test Provider 1", true, {
				frameSummary: false,
			})
			registry.registerProvider(provider)

			await expect(
				registry.preflightCheck({ frameSummary: true }),
			).rejects.toThrow()
		})

		it("should throw when no providers available", async () => {
			await expect(
				registry.preflightCheck({ frameSummary: true }),
			).rejects.toThrow()
		})
	})
})

