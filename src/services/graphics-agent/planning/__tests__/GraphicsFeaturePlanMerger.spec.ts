/**
 * Covers the deterministic merge contract independently from VS Code and Webview
 * adapters so future protocol changes cannot silently alter merge semantics.
 */
import { describe, expect, it } from "vitest"
import type { GraphicsFeaturePlan, GraphicsFeatureTask } from "@roo-code/types"
import { mergeGraphicsFeaturePlans } from "../GraphicsFeaturePlanMerger"

const createPlan = (): GraphicsFeaturePlan => ({
	version: 1,
	revision: 1,
	source: "generated",
	updatedAt: "2026-07-30T00:00:00.000Z",
	title: "Base title",
	briefSummary: "Base summary",
	openQuestions: [],
	projectContext: [],
	decision: { recommendedLevel: "shader", rationale: [], alternatives: [] },
	pipelineDesign: { summary: "Base pipeline", details: [] },
	shaderDesign: { summary: "Base shader", details: [] },
	clientDesign: { summary: "Base client", details: [] },
	assetContract: { requirements: [], validationRules: [] },
	performanceBudget: { summary: "", details: [] },
	compatibility: [{ target: "PC", strategy: "base", fallback: "none" }],
	risks: [],
	tasks: [],
	acceptancePlan: [],
	generatedAt: "2026-07-30T00:00:00.000Z",
})

describe("mergeGraphicsFeaturePlans", () => {
	it("merges independent scalar and identity-array edits without conflicts", () => {
		const base = createPlan()
		const localTask: GraphicsFeatureTask = {
			id: "local-task",
			kind: "shader",
			title: "Local",
			owner: "graphics",
			status: "pending",
			inputs: [],
			outputs: [],
			dependsOn: [],
			completionConditions: [],
		}
		const local: GraphicsFeaturePlan = {
			...base,
			title: "Local title",
			tasks: [localTask],
		}
		const current: GraphicsFeaturePlan = {
			...base,
			briefSummary: "Shared summary",
			compatibility: [{ target: "PC", strategy: "shared", fallback: "base" }],
		}

		const result = mergeGraphicsFeaturePlans(base, local, current)

		expect(result.conflicts).toHaveLength(0)
		expect(result.mergedPlan.title).toBe("Local title")
		expect(result.mergedPlan.briefSummary).toBe("Shared summary")
		expect(result.mergedPlan.tasks).toHaveLength(1)
		expect(result.mergedPlan.compatibility[0].strategy).toBe("shared")
	})

	it("reports a field conflict and applies an explicit local choice", () => {
		const base = createPlan()
		const local = { ...base, title: "Local title" }
		const current = { ...base, title: "Shared title" }

		const preview = mergeGraphicsFeaturePlans(base, local, current)
		expect(preview.conflicts.map((conflict) => conflict.path)).toContain("title")
		expect(preview.mergedPlan.title).toBe("Shared title")

		const resolved = mergeGraphicsFeaturePlans(base, local, current, { title: "local" })
		expect(resolved.conflicts).toHaveLength(1)
		expect(resolved.mergedPlan.title).toBe("Local title")
	})
})
