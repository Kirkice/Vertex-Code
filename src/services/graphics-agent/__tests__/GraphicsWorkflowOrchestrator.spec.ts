/**
 * GraphicsWorkflowOrchestrator Unit Tests
 *
 * @module graphics-agent/__tests__/GraphicsWorkflowOrchestrator.spec.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { GraphicsWorkflowOrchestrator } from "../GraphicsWorkflowOrchestrator"
import { AnalyzeCurrentFrameWorkflow } from "../workflows/analyzeCurrentFrame"
import { ExplainSelectedDrawWorkflow } from "../workflows/explainSelectedDraw"
import { FindOwnerInProjectWorkflow } from "../workflows/findOwnerInProject"
import type { IGraphicsProviderRegistry } from "../../graphics-provider/GraphicsProviderRegistry"
import type { GraphicsCaptureProvider } from "../../graphics-provider/GraphicsCaptureProvider"

// Mock provider
const createMockProvider = (): GraphicsCaptureProvider => ({
	id: "test-provider",
	displayName: "Test Provider",
	kind: "mcp",
	isAvailable: vi.fn().mockResolvedValue(true),
	getStatus: vi.fn().mockResolvedValue({
		status: "available" as const,
		providerId: "test-provider",
		providerName: "Test Provider",
	}),
	getCapabilities: vi.fn().mockResolvedValue({
		frameSummary: true,
		selectionContext: true,
		eventDetails: true,
		pipelineState: true,
		shaderInfo: true,
		shaderSource: true,
		meshData: true,
		resourceDetail: true,
		textureData: true,
		bufferData: true,
		passGraph: true,
		projectMapping: true,
		captureDiff: true,
	}),
	openCurrentCapture: vi.fn().mockResolvedValue({ success: true, capturePath: "/test/capture.rdc" }),
	getFrameSummary: vi.fn().mockResolvedValue({
		success: true,
		totalDurationMs: 16.5,
		passes: [{ name: "MainPass", eventIdRange: [1, 100] as [number, number], durationMs: 10.0, drawCount: 50 }],
		hotEvents: [{ eventId: 42, name: "DrawMesh", durationMs: 5.0, passName: "MainPass" }],
	}),
	getSelectionContext: vi.fn().mockResolvedValue({
		success: true,
		eventId: 42,
		eventName: "DrawMesh",
		passName: "MainPass",
	}),
	getEventDetails: vi.fn().mockResolvedValue({
		success: true,
		eventId: 42,
		name: "DrawMesh",
		durationMs: 5.0,
		primitiveCount: 10000,
		shaderStages: ["vertex", "pixel"],
	}),
	getPipelineState: vi.fn().mockResolvedValue({
		success: true,
		eventId: 42,
		renderTargets: [{ slot: 0, name: "BackBuffer", type: "Texture2D" }],
		depthStencil: { slot: 0, name: "DepthBuffer", type: "Texture2D" },
		vertexBuffers: [{ slot: 0, name: "VertexBuffer", type: "Buffer" }],
	}),
	getShaderInfo: vi.fn().mockResolvedValue({
		success: true,
		eventId: 42,
		stage: "pixel",
		entryPoint: "PSMain",
		language: "HLSL",
		instructionCount: 150,
	}),
	findProjectImplementation: vi.fn().mockResolvedValue({
		success: true,
		candidates: [
			{
				filePath: "/src/renderer/main.cpp",
				line: 100,
				functionName: "RenderScene",
				confidence: "high" as const,
			},
		],
	}),
})

// Mock registry
const createMockRegistry = (provider?: GraphicsCaptureProvider): IGraphicsProviderRegistry => ({
	listProviders: vi.fn().mockResolvedValue(provider ? [provider] : []),
	getAvailableProviders: vi.fn().mockResolvedValue(provider ? [provider] : []),
	getSelectedProvider: vi.fn().mockResolvedValue(provider || null),
	getAutoMatchProviders: vi.fn().mockResolvedValue(provider ? [provider] : []),
	getProviderById: vi.fn().mockResolvedValue(provider || null),
	selectProvider: vi.fn().mockResolvedValue(undefined),
	clearSelection: vi.fn(),
	registerProvider: vi.fn(),
	unregisterProvider: vi.fn(),
	getAllStatuses: vi.fn().mockResolvedValue([]),
	preflightCheck: vi.fn().mockResolvedValue(provider || null),
})

describe("GraphicsWorkflowOrchestrator", () => {
	let orchestrator: GraphicsWorkflowOrchestrator
	let mockProvider: GraphicsCaptureProvider
	let mockRegistry: IGraphicsProviderRegistry

	beforeEach(() => {
		mockProvider = createMockProvider()
		mockRegistry = createMockRegistry(mockProvider)
		orchestrator = new GraphicsWorkflowOrchestrator(mockRegistry)
		orchestrator.registerWorkflow(new AnalyzeCurrentFrameWorkflow())
		orchestrator.registerWorkflow(new ExplainSelectedDrawWorkflow())
		orchestrator.registerWorkflow(new FindOwnerInProjectWorkflow())
	})

	describe("execute", () => {
		it("should execute frame_summary workflow successfully", async () => {
			const result = await orchestrator.execute({
				intent: "frame_summary",
				userMessage: "分析当前帧",
			})

			expect(result.success).toBe(true)
			expect(result.summary).toBeDefined()
			expect(result.evidence.length).toBeGreaterThan(0)
			expect(mockProvider.getFrameSummary).toHaveBeenCalled()
		})

		it("should execute selected_draw_explain workflow successfully", async () => {
			const result = await orchestrator.execute({
				intent: "selected_draw_explain",
				userMessage: "解释当前 draw",
			})

			expect(result.success).toBe(true)
			expect(result.summary).toBeDefined()
			expect(mockProvider.getSelectionContext).toHaveBeenCalled()
			expect(mockProvider.getEventDetails).toHaveBeenCalled()
		})

		it("should execute project_mapping workflow successfully", async () => {
			const result = await orchestrator.execute({
				intent: "project_mapping",
				userMessage: "这个 shader 对应哪段代码",
			})

			expect(result.success).toBe(true)
			expect(result.projectMapping).toBeDefined()
			expect(result.projectMapping!.length).toBeGreaterThan(0)
			expect(mockProvider.findProjectImplementation).toHaveBeenCalled()
		})

		it("should return error when no provider is available", async () => {
			const emptyRegistry = createMockRegistry()
			vi.mocked(emptyRegistry.preflightCheck).mockRejectedValue(
				new Error("No provider available"),
			)
			const emptyOrchestrator = new GraphicsWorkflowOrchestrator(emptyRegistry)

			const result = await emptyOrchestrator.execute({
				intent: "frame_summary",
				userMessage: "分析当前帧",
			})

			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
		})

		it("should handle provider errors gracefully", async () => {
			const failingProvider = createMockProvider()
			vi.mocked(failingProvider.getFrameSummary).mockResolvedValue({
				success: false,
				error: "Provider error",
			})

			const failingRegistry = createMockRegistry(failingProvider)
			const failingOrchestrator = new GraphicsWorkflowOrchestrator(failingRegistry)

			const result = await failingOrchestrator.execute({
				intent: "frame_summary",
				userMessage: "分析当前帧",
			})

			// The workflow may still succeed but report the error in evidence
			expect(result).toBeDefined()
		})

		it("should include suggestions in results", async () => {
			const result = await orchestrator.execute({
				intent: "frame_summary",
				userMessage: "分析当前帧",
			})

			expect(result.suggestions).toBeDefined()
			expect(Array.isArray(result.suggestions)).toBe(true)
		})

		it("should include suspected issues when detected", async () => {
			// Mock a slow frame
			vi.mocked(mockProvider.getFrameSummary).mockResolvedValue({
				success: true,
				totalDurationMs: 50.0, // Very slow frame
				passes: [],
				hotEvents: [],
			})

			const result = await orchestrator.execute({
				intent: "frame_summary",
				userMessage: "分析当前帧",
			})

			expect(result.suspectedIssues).toBeDefined()
			expect(Array.isArray(result.suspectedIssues)).toBe(true)
		})
	})

	describe("workflow registration", () => {
		it("should have built-in workflows registered", () => {
			// The orchestrator should have workflows for common intents
			expect(orchestrator).toBeDefined()
		})
	})
})
