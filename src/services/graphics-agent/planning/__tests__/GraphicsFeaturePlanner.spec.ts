import type { GraphicsFeatureBrief, GraphicsProjectProfile, GraphicsSolutionRecommendation } from "@roo-code/types"

import { createGraphicsFeaturePlan } from "../GraphicsFeaturePlanner"

const brief: GraphicsFeatureBrief = {
	version: 1,
	title: "Stylized outline",
	visualGoal: "Readable camera-wide silhouette using depth and normals",
	lifecycle: "Enabled for selected characters during gameplay",
	artControls: "Width, color, and occlusion response",
	targetPlatforms: "Windows, Android",
	performanceBudget: "Under 0.4 ms GPU",
	compatibilityRequirements: "URP, Vulkan, and dynamic resolution",
	acceptanceCriteria: "Stable silhouette at every supported resolution",
}

const profile: GraphicsProjectProfile = {
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
				path: "Assets/OutlineFeature.cs",
				kind: "renderer-feature",
				detail: "Reusable renderer feature.",
			},
		],
		analyzedFileCount: 3,
		truncated: false,
	},
	evidence: [],
	warnings: [],
	scannedAt: "2026-07-30T00:00:00.000Z",
}

const recommendation: GraphicsSolutionRecommendation = {
	version: 1,
	recommendedLevel: "renderer-pass",
	summary: "Renderer pass is the lowest-risk fit.",
	candidates: [
		{
			level: "renderer-pass",
			label: "Renderer pass",
			score: 48,
			confidence: "high",
			reasons: ["Existing renderer feature."],
			risks: [],
			rejectionReasons: [],
		},
		{
			level: "shader",
			label: "Shader",
			score: 30,
			confidence: "low",
			reasons: [],
			risks: [],
			rejectionReasons: ["Camera-wide data is required."],
		},
		{
			level: "post-process",
			label: "Post-process",
			score: 28,
			confidence: "low",
			reasons: [],
			risks: [],
			rejectionReasons: ["Object selection is required."],
		},
	],
	assumptions: [],
	generatedAt: "2026-07-30T00:00:00.000Z",
}

describe("createGraphicsFeaturePlan", () => {
	it("creates complete cross-module sections and dependency-ordered verifiable tasks", () => {
		const plan = createGraphicsFeaturePlan(brief, profile, recommendation, {
			now: () => new Date("2026-07-30T02:00:00.000Z"),
		})

		expect(plan).toEqual(
			expect.objectContaining({ version: 1, title: brief.title, generatedAt: "2026-07-30T02:00:00.000Z" }),
		)
		expect(plan.pipelineDesign.summary).toContain("dedicated pass")
		expect(plan.shaderDesign.details).not.toHaveLength(0)
		expect(plan.clientDesign.details).not.toHaveLength(0)
		expect(plan.assetContract.validationRules).not.toHaveLength(0)
		expect(plan.compatibility.map((item) => item.target)).toEqual(
			expect.arrayContaining(["Windows", "Android", "Vulkan"]),
		)
		expect(plan.acceptancePlan.map((item) => item.dimension)).toEqual([
			"visual",
			"functional",
			"performance",
			"compatibility",
		])
		expect(plan.tasks.map((task) => task.id)).toEqual(["T1", "T2", "T3", "T4", "T5", "T6", "T7"])
		expect(plan.tasks.find((task) => task.id === "T6")?.dependsOn).toEqual(["T4", "T5"])
		expect(
			plan.tasks.every(
				(task) => task.inputs.length > 0 && task.outputs.length > 0 && task.completionConditions.length > 0,
			),
		).toBe(true)
		expect(plan.risks[0].reviewGate).toContain("pass ordering")
	})

	it("surfaces scan truncation and missing requirements rather than inventing certainty", () => {
		const plan = createGraphicsFeaturePlan(
			{ ...brief, performanceBudget: "", targetPlatforms: "", compatibilityRequirements: "" },
			{
				...profile,
				targetPlatforms: [],
				graphicsApis: [],
				architectureIndex: { ...profile.architectureIndex, truncated: true },
			},
			{ ...recommendation, assumptions: ["No explicit performance budget was provided."] },
		)

		expect(plan.openQuestions).toContain("No explicit performance budget was provided.")
		expect(plan.performanceBudget.summary).toContain("confirmed")
		expect(plan.compatibility[0].target).toBe("Target platform to be confirmed")
		expect(plan.risks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ title: expect.stringContaining("bounded architecture scan") }),
			]),
		)
	})
})
