import { describe, expect, it, vi } from "vitest"
import type { GraphicsCaptureProvider } from "../../graphics-provider/GraphicsCaptureProvider"
import type { GraphicsLaunchProfile } from "../../graphics-provider/GraphicsProviderTypes"
import { GraphicsOperationController, GraphicsOperationStageError } from "../GraphicsOperationController"

const profile: GraphicsLaunchProfile = {
	version: 1,
	id: "test-profile",
	name: "Test Profile",
	platform: "windows",
	executable: "C:\\game\\game.exe",
	captureTrigger: { mode: "immediate" },
	startupWaitMs: 0,
	updatedAt: "2026-01-01T00:00:00.000Z",
}

function createProvider(): GraphicsCaptureProvider {
	return {
		id: "test-provider",
		displayName: "Test Provider",
		kind: "mcp",
		isAvailable: vi.fn().mockResolvedValue(true),
		getStatus: vi.fn().mockResolvedValue({ status: "available", providerId: "test-provider", providerName: "Test Provider" }),
		getCapabilities: vi.fn().mockResolvedValue({ launchTarget: true, liveTarget: true, captureTrigger: true, capturePolling: true }),
		openCurrentCapture: vi.fn(),
		getSelectionContext: vi.fn(),
		getEventDetails: vi.fn(),
		getPipelineState: vi.fn(),
		getShaderInfo: vi.fn(),
		getShaderSource: vi.fn(),
		getResourceHistory: vi.fn(),
		diffPipelineState: vi.fn(),
		findProjectImplementation: vi.fn(),
		getFrameSummary: vi.fn(),
		launchTarget: vi.fn().mockResolvedValue({ success: true, targetId: "target-1" }),
		waitForLiveTarget: vi.fn().mockResolvedValue({ success: true, ready: true }),
		triggerCapture: vi.fn().mockResolvedValue({ success: true, operationId: "capture-1" }),
		waitForCapture: vi.fn().mockResolvedValue({ success: true, completed: true, capturePath: "capture.rdc" }),
	}
}

describe("GraphicsOperationController", () => {
	it("runs all lifecycle stages and reports progress", async () => {
		const provider = createProvider()
		const progress: string[] = []
		const result = await new GraphicsOperationController(provider, {
			onProgress: ({ stage, completedStages }) => progress.push(`${stage}:${completedStages.join(",")}`),
		}).run(profile)

		expect(result.completed.completed).toBe(true)
		expect(progress).toEqual([
			"launch:",
			"launch:launch",
			"live-target:launch",
			"live-target:launch,live-target",
			"capture-trigger:launch,live-target",
			"capture-trigger:launch,live-target,capture-trigger",
			"capture-completion:launch,live-target,capture-trigger",
			"capture-completion:launch,live-target,capture-trigger,capture-completion",
		])
	})

	it("wraps a stage timeout with the stage name", async () => {
		const provider = createProvider()
		vi.mocked(provider.waitForLiveTarget!).mockImplementation(() => new Promise(() => undefined))

		await expect(
			new GraphicsOperationController(provider, { timeouts: { "live-target": 1 } }).run(profile),
		).rejects.toMatchObject({
			name: "GraphicsOperationStageError",
			stage: "live-target",
			message: "TIMEOUT",
		})
	})

	it("stops at an already-aborted signal", async () => {
		const provider = createProvider()
		const controller = new AbortController()
		controller.abort()

		await expect(new GraphicsOperationController(provider).run(profile, { signal: controller.signal })).rejects.toMatchObject({
			stage: "launch",
			message: "CANCELLED",
		})
		expect(provider.launchTarget).not.toHaveBeenCalled()
	})

	it("rejects when the provider lifecycle is incomplete", async () => {
		const provider = createProvider()
		delete provider.triggerCapture

		await expect(new GraphicsOperationController(provider).run(profile)).rejects.toThrow("PROVIDER_UNAVAILABLE")
	})

	it("exposes the original stage error", async () => {
		const provider = createProvider()
		const original = new Error("launch failed")
		vi.mocked(provider.launchTarget!).mockRejectedValue(original)

		try {
			await new GraphicsOperationController(provider).run(profile)
			throw new Error("expected rejection")
		} catch (error) {
			expect(error).toBeInstanceOf(GraphicsOperationStageError)
			expect((error as GraphicsOperationStageError).originalError).toBe(original)
		}
	})
})
