import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type {
	GraphicsFeatureBrief,
	GraphicsFeaturePlan,
	GraphicsProjectProfile,
	GraphicsSolutionRecommendation,
} from "@roo-code/types"
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

const createProfile = (): GraphicsProjectProfile => ({
	version: 1,
	workspaceName: "outline-project",
	engine: "unity",
	engineVersion: "2022.3.48f1",
	renderPipelines: ["Unity URP"],
	graphicsApis: ["Vulkan"],
	targetPlatforms: ["PC"],
	shaderLanguages: ["ShaderLab/HLSL"],
	architectureSignals: ["Renderer Feature / Scriptable Render Pass"],
	architectureIndex: {
		version: 1,
		findings: [],
		analyzedFileCount: 1,
		truncated: false,
	},
	evidence: [],
	warnings: [],
	scannedAt: "2026-07-30T00:00:00.000Z",
})

const createRecommendation = (): GraphicsSolutionRecommendation => ({
	version: 1,
	recommendedLevel: "shader",
	summary: "Use a shader-local implementation.",
	candidates: [],
	assumptions: [],
	decisionHistory: [
		{
			source: "human-override",
			decision: "shader",
			reason: "Keep the prototype material-only.",
			at: "2026-07-30T00:00:00.000Z",
		},
	],
	generatedAt: "2026-07-30T00:00:00.000Z",
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

	it("round-trips all project planning artifacts, including history and executions", async () => {
		const store = new GraphicsFeatureWorkspaceStore(workspacePath)
		const brief = createBrief()
		const profile = createProfile()
		const recommendation = createRecommendation()
		const plan: GraphicsFeaturePlan = {
			...createPlan(),
			executions: [
				{
					taskId: "T1",
					executor: "agent",
					role: "graphics",
					status: "succeeded",
					output: ["Prototype validated"],
				},
			],
		}

		expect(await store.saveBrief(brief)).toBe(true)
		expect(await store.saveProfile(profile)).toBe(true)
		expect(await store.saveRecommendation(recommendation)).toBe(true)
		expect(await store.savePlan(plan)).toBe(true)
		expect(await store.loadBrief()).toEqual(brief)
		expect(await store.loadProfile()).toEqual(profile)
		expect(await store.loadRecommendation()).toEqual(recommendation)
		expect(await store.loadPlan()).toEqual(plan)
		expect(await readFile(path.join(workspacePath, ".roo/graphics/feature-plan.json"), "utf8")).toContain(
			'"revision": 3',
		)
	})

	it("round-trips independently persisted plan artifacts and recovers legacy embedded fields", async () => {
		const store = new GraphicsFeatureWorkspaceStore(workspacePath)
		const plan = createPlan()

		expect(await store.savePlan(plan)).toBe(true)
		expect(await store.savePlanArtifacts(plan)).toBe(true)

		const artifacts = await store.loadPlanArtifacts()
		expect(artifacts?.architectureDecision.value).toEqual(plan.decision)
		expect(artifacts?.assetContract.value).toEqual(plan.assetContract)
		expect(artifacts?.performanceBudget.value).toEqual(plan.performanceBudget)
		expect(artifacts?.compatibilityMatrix.value).toEqual(plan.compatibility)
		expect(artifacts?.verificationReport.value.checks).toEqual(plan.acceptancePlan)
		expect(artifacts?.architectureDecision.featurePlanRevision).toBe(plan.revision)

		await rm(path.join(workspacePath, ".roo/graphics/architecture-decision.json"), { force: true })
		const recovered = await store.loadPlanArtifacts(plan)
		expect(recovered?.architectureDecision.value).toEqual(plan.decision)
		expect(recovered?.verificationReport.value.status).toBe("pending")
	})

	it("returns undefined without a workspace path and does not touch the filesystem", async () => {
		const store = new GraphicsFeatureWorkspaceStore(undefined)

		expect(await store.loadBrief()).toBeUndefined()
		expect(await store.loadPlan()).toBeUndefined()
		expect(await store.loadProfile()).toBeUndefined()
		expect(await store.loadRecommendation()).toBeUndefined()
		expect(await store.loadPlanArtifacts()).toBeUndefined()
		expect(await store.saveBrief(createBrief())).toBe(false)
		expect(await store.savePlan(createPlan())).toBe(false)
		expect(await store.saveProfile(createProfile())).toBe(false)
		expect(await store.saveRecommendation(createRecommendation())).toBe(false)
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
	it("rejects a stale conditional plan write and returns the current snapshot", async () => {
		const store = new GraphicsFeatureWorkspaceStore(workspacePath)
		const initial = createPlan()
		await store.savePlan(initial)
		const snapshot = await store.loadPlanSnapshot()
		expect(snapshot).toBeDefined()

		await store.savePlan({ ...initial, revision: 4, title: "Updated by another window" })
		const result = await store.savePlanIfUnchanged({ ...initial, revision: 4, title: "Stale edit" }, snapshot)

		expect(result.saved).toBe(false)
		expect(result.conflict).toBe(true)
		expect(result.current?.value.title).toBe("Updated by another window")
	})

	it("allows a conditional write when the observed snapshot is still current", async () => {
		const store = new GraphicsFeatureWorkspaceStore(workspacePath)
		const initial = createPlan()
		const resultWithoutFile = await store.savePlanIfUnchanged(initial, undefined)
		expect(resultWithoutFile.saved).toBe(true)
		expect(resultWithoutFile.conflict).toBe(false)

		const snapshot = await store.loadPlanSnapshot()
		const result = await store.savePlanIfUnchanged({ ...initial, revision: 4 }, snapshot)
		expect(result.saved).toBe(true)
		expect(result.conflict).toBe(false)
	})
})
