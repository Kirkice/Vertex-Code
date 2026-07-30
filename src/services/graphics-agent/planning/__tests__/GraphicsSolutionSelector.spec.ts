import type { GraphicsFeatureBrief, GraphicsProjectProfile } from "@roo-code/types"

import { selectGraphicsSolution } from "../GraphicsSolutionSelector"

const createBrief = (overrides: Partial<GraphicsFeatureBrief> = {}): GraphicsFeatureBrief => ({
	version: 1,
	title: "Stylized outline",
	visualGoal: "Add a camera-wide outline using depth and normals",
	lifecycle: "Enabled during gameplay by a client event",
	artControls: "Outline width and color",
	targetPlatforms: "Windows and Android",
	performanceBudget: "Under 0.4 ms GPU",
	compatibilityRequirements: "URP camera stacking and dynamic resolution",
	acceptanceCriteria: "Stable silhouette around selected characters",
	...overrides,
})

const createProfile = (overrides: Partial<GraphicsProjectProfile> = {}): GraphicsProjectProfile => ({
	version: 1,
	workspaceName: "SampleGame",
	engine: "unity",
	engineVersion: "2022.3",
	renderPipelines: ["Unity URP"],
	graphicsApis: ["Vulkan"],
	targetPlatforms: ["Android"],
	shaderLanguages: ["ShaderLab/HLSL"],
	architectureSignals: ["Renderer Feature / Scriptable Render Pass"],
	architectureIndex: {
		version: 1,
		findings: [
			{
				category: "pass",
				path: "Assets/Rendering/OutlineFeature.cs",
				kind: "renderer-feature",
				detail: "Renderer Feature class OutlineFeature.",
			},
		],
		analyzedFileCount: 1,
		truncated: false,
	},
	evidence: [],
	warnings: [],
	scannedAt: "2026-07-30T00:00:00.000Z",
	...overrides,
})

describe("selectGraphicsSolution", () => {
	it("prefers an existing renderer pass for a camera-wide depth and normal effect", () => {
		const recommendation = selectGraphicsSolution(createBrief(), createProfile(), {
			now: () => new Date("2026-07-30T01:00:00.000Z"),
		})

		expect(recommendation.recommendedLevel).toBe("renderer-pass")
		expect(recommendation.candidates[0]).toEqual(
			expect.objectContaining({
				level: "renderer-pass",
				confidence: "high",
			}),
		)
		expect(recommendation.candidates[0].reasons).toContain(
			"The project already exposes a custom pass or renderer-feature extension point.",
		)
		expect(recommendation.generatedAt).toBe("2026-07-30T01:00:00.000Z")
	})

	it("prefers compute for a large GPU simulation and exposes missing-input assumptions", () => {
		const recommendation = selectGraphicsSolution(
			createBrief({
				title: "GPU particle simulation",
				visualGoal: "Simulate and draw one million GPU generated particles with indirect drawing",
				lifecycle: "",
				artControls: "",
				targetPlatforms: "",
				performanceBudget: "",
				compatibilityRequirements: "",
				acceptanceCriteria: "",
			}),
			createProfile({
				engine: "unknown",
				architectureSignals: [],
				architectureIndex: { version: 1, findings: [], analyzedFileCount: 0, truncated: true },
			}),
		)

		expect(recommendation.recommendedLevel).toBe("compute")
		expect(recommendation.assumptions).toEqual(
			expect.arrayContaining([
				"No explicit performance budget was provided.",
				"No target platform or graphics API was provided.",
				"The project engine is unknown, so integration confidence is limited.",
				"The architecture index was truncated and may omit reusable entry points.",
			]),
		)
		expect(
			recommendation.candidates.find((candidate) => candidate.level === "render-graph")?.rejectionReasons,
		).not.toHaveLength(0)
	})

	it("matches Chinese requirements without relying on ASCII word boundaries", () => {
		const recommendation = selectGraphicsSolution(
			createBrief({
				title: "GPU 粒子模拟",
				visualGoal: "使用 GPU 并行模拟百万粒子并进行间接绘制",
				lifecycle: "由玩法事件触发",
				artControls: "",
				compatibilityRequirements: "",
				acceptanceCriteria: "",
			}),
			createProfile({
				architectureSignals: [],
				architectureIndex: { version: 1, findings: [], analyzedFileCount: 0, truncated: false },
			}),
		)

		expect(recommendation.recommendedLevel).toBe("compute")
		expect(recommendation.candidates[0].reasons).toContain(
			"The workload suggests large-scale parallel processing or GPU-generated data.",
		)
	})
})
