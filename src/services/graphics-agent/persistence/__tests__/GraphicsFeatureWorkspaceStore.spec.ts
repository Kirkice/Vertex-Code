import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { GraphicsFeatureBrief, GraphicsFeaturePlan } from "@roo-code/types"
import { GraphicsFeatureWorkspaceStore } from "../GraphicsFeatureWorkspaceStore"

const createBrief = (): GraphicsFeatureBrief => ({
	version: 1,
	title: "Outline",
	visualGoal: "Readable silhouette",
	lifecycle: "Gameplay",
	artControls: "Width",
	targetPlatforms: "PC",
	performanceBudget: "0.3 ms",
	compatibilityRequirements: "DX12",
	acceptanceCriteria: "Stable",
})

const createPlan = (): GraphicsFeaturePlan => ({
	version: 1,
	revision: 3,
	source: "manual",
	updatedAt: "2026-07-30T00:00:00.000Z",
	title: "Outline",
	briefSummary: "Readable silhouette",
	openQuestions: [],
	projectContext: [],
	decision: { recommendedLevel: "shader", rationale: [], alternatives: [] },
	pipelineDesign: { summary: "", details: [] },
	shaderDesign: { summary: "", details: [] },
	clientDesign: { summary: "", details: [] },
	assetContract: { requirements: [], validationRules: [] },
	performanceBudget: { summary: "", details: [] },
	compatibility: [],
	risks: [],
	tasks: [],
	acceptancePlan: [],
	generatedAt: "2026-07-30T00:00:00.000Z",
})

describe("GraphicsFeatureWorkspaceStore", () => {
	let workspacePath: string

	beforeEach(async () => {
		workspacePath = await mkdtemp(path.join(os.tmpdir(), "vertex-graphics-workspace-"))
	})

	afterEach(async () => {
		await rm(workspacePath, { recursive: true, force: true })
	})

	it("round-trips Feature Brief and Feature Plan project files", async () => {
		const store = new GraphicsFeatureWorkspaceStore(workspacePath)
		const brief = createBrief()
		const plan = createPlan()

		expect(await store.saveBrief(brief)).toBe(true)
		expect(await store.savePlan(plan)).toBe(true)
		expect(await store.loadBrief()).toEqual(brief)
		expect(await store.loadPlan()).toEqual(plan)
		expect(await readFile(path.join(workspacePath, ".roo/graphics/feature-plan.json"), "utf8")).toContain(
			'"revision": 3',
		)
	})

	it("returns undefined without a workspace path and does not touch the filesystem", async () => {
		const store = new GraphicsFeatureWorkspaceStore(undefined)

		expect(await store.loadBrief()).toBeUndefined()
		expect(await store.loadPlan()).toBeUndefined()
		expect(await store.saveBrief(createBrief())).toBe(false)
		expect(await store.savePlan(createPlan())).toBe(false)
	})

	it("falls back cleanly when a project file is missing or malformed", async () => {
		const messages: string[] = []
		const store = new GraphicsFeatureWorkspaceStore(workspacePath, (message) => messages.push(message))
		const filePath = path.join(workspacePath, ".roo/graphics/feature-plan.json")

		expect(await store.loadPlan()).toBeUndefined()
		await store.savePlan(createPlan())
		await writeFile(filePath, "{not-json", "utf8")

		expect(await store.loadPlan()).toBeUndefined()
		expect(messages.some((message) => message.includes("Could not read project file"))).toBe(true)
	})
})
