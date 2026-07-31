import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

/** Retries Windows temporary-directory cleanup while filesystem handles settle. */
const removeWorkspaceWithRetry = async (workspacePath: string): Promise<void> => {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		try {
			await rm(workspacePath, { recursive: true, force: true })
			return
		} catch (error) {
			const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined
			if (code !== "ENOTEMPTY" && code !== "EPERM" && code !== "EBUSY") throw error
			await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)))
		}
	}
	await rm(workspacePath, { recursive: true, force: true })
}
import type { GraphicsFeatureBrief, GraphicsFeaturePlan, WebviewMessage } from "@roo-code/types"

import type { ClineProvider } from "../ClineProvider"
import { handleGraphicsMessage } from "../graphicsMessageHandler"

const createBrief = (title = "Stylized outline"): GraphicsFeatureBrief => ({
	version: 1,
	title,
	visualGoal: "Readable silhouette",
	lifecycle: "Enabled during gameplay",
	artControls: "Width and color",
	targetPlatforms: "PC",
	performanceBudget: "Under 0.3 ms GPU",
	compatibilityRequirements: "DX12 and Vulkan",
	acceptanceCriteria: "Stable at target resolution",
	updatedAt: "2026-07-30T00:00:00.000Z",
})

/** Uses the smallest valid plan shape needed to exercise workspace edit normalization. */
const createPlan = (): GraphicsFeaturePlan => ({
	version: 1,
	revision: 1,
	source: "generated",
	updatedAt: "2026-07-30T00:00:00.000Z",
	title: "Test plan",
	briefSummary: "Test summary",
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

const GRAPHICS_FEATURE_PLAN_WORKSPACE_KEY = "graphicsFeaturePlan"

describe("handleGraphicsMessage Feature Brief persistence", () => {
	const workspaceState = {
		get: vi.fn(),
		update: vi.fn(),
	}
	const postMessageToWebview = vi.fn()
	const log = vi.fn()
	const provider = {
		context: { workspaceState },
		cwd: undefined,
		postMessageToWebview,
		log,
	} as unknown as ClineProvider
	const createWorkspaceProvider = (workspacePath: string) =>
		({
			context: { workspaceState },
			cwd: workspacePath,
			postMessageToWebview,
			log,
		}) as unknown as ClineProvider

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("loads the workspace Feature Brief and posts it to the webview", async () => {
		const graphicsFeatureBrief = createBrief()
		workspaceState.get.mockReturnValue(graphicsFeatureBrief)

		const handled = await handleGraphicsMessage(provider, {
			type: "requestGraphicsFeatureBrief",
		})

		expect(handled).toBe(true)
		expect(workspaceState.get).toHaveBeenCalledWith("graphicsFeatureBrief")
		expect(postMessageToWebview).toHaveBeenCalledWith({
			type: "graphicsFeatureBrief",
			graphicsFeatureBrief,
		})
	})

	it("recovers the persisted Feature Plan without regenerating it", async () => {
		const plan = {
			revision: 4,
			version: 1,
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		const handled = await handleGraphicsMessage(provider, {
			type: "requestGraphicsFeaturePlanRecovery",
		})

		expect(handled).toBe(true)
		expect(workspaceState.get).toHaveBeenCalledWith("graphicsFeaturePlan")
		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "graphicsFeaturePlanRecovered",
				graphicsFeaturePlan: plan,
				graphicsFeaturePlanArtifacts: expect.any(Object),
			}),
		)
	})

	it("posts an empty response when the workspace has no Feature Brief", async () => {
		workspaceState.get.mockReturnValue(undefined)

		await handleGraphicsMessage(provider, {
			type: "requestGraphicsFeatureBrief",
		})

		expect(postMessageToWebview).toHaveBeenCalledWith({
			type: "graphicsFeatureBrief",
			graphicsFeatureBrief: undefined,
		})
	})

	it("saves a supported Feature Brief and confirms it to the webview", async () => {
		const graphicsFeatureBrief = createBrief()
		const message: WebviewMessage = {
			type: "saveGraphicsFeatureBrief",
			graphicsFeatureBrief,
		}

		const handled = await handleGraphicsMessage(provider, message)

		expect(handled).toBe(true)
		expect(workspaceState.update).toHaveBeenCalledWith("graphicsFeatureBrief", graphicsFeatureBrief)
		expect(postMessageToWebview).toHaveBeenCalledWith({
			type: "graphicsFeatureBrief",
			graphicsFeatureBrief,
		})
	})

	it("loads a project Feature Brief before checking the workspaceState cache", async () => {
		const workspacePath = await mkdtemp(path.join(os.tmpdir(), "vertex-graphics-handler-"))
		try {
			const graphicsFeatureBrief = createBrief("Shared outline")
			const storeDirectory = path.join(workspacePath, ".roo", "graphics")
			await mkdir(storeDirectory, { recursive: true })
			await writeFile(
				path.join(storeDirectory, "feature-brief.json"),
				JSON.stringify(graphicsFeatureBrief),
				"utf8",
			)

			await handleGraphicsMessage(createWorkspaceProvider(workspacePath), {
				type: "requestGraphicsFeatureBrief",
			})

			expect(postMessageToWebview).toHaveBeenCalledWith({
				type: "graphicsFeatureBrief",
				graphicsFeatureBrief,
			})
			expect(workspaceState.get).not.toHaveBeenCalledWith("graphicsFeatureBrief")
		} finally {
			await rm(workspacePath, { recursive: true, force: true })
		}
	})

	it("rejects a missing Feature Brief without updating workspace state", async () => {
		const handled = await handleGraphicsMessage(provider, {
			type: "saveGraphicsFeatureBrief",
		})

		expect(handled).toBe(true)
		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(postMessageToWebview).not.toHaveBeenCalled()
		expect(log).toHaveBeenCalledWith("[Graphics] saveGraphicsFeatureBrief: missing or unsupported brief")
	})

	it("generates a typed solution recommendation from the submitted brief", async () => {
		const graphicsFeatureBrief = createBrief("Fullscreen outline using depth and normals")

		const handled = await handleGraphicsMessage(provider, {
			type: "requestGraphicsSolutionRecommendation",
			graphicsFeatureBrief,
		})

		expect(handled).toBe(true)
		expect(postMessageToWebview).toHaveBeenCalledWith({
			type: "graphicsSolutionRecommendation",
			graphicsSolutionRecommendation: expect.objectContaining({
				version: 1,
				recommendedLevel: expect.any(String),
				candidates: expect.any(Array),
			}),
		})
	})

	it("generates a typed cross-module feature plan from the submitted brief", async () => {
		const handled = await handleGraphicsMessage(provider, {
			type: "requestGraphicsFeaturePlan",
			graphicsFeatureBrief: createBrief("Fullscreen outline using depth and normals"),
		})

		expect(handled).toBe(true)
		expect(postMessageToWebview).toHaveBeenCalledWith({
			type: "graphicsFeaturePlan",
			graphicsFeaturePlan: expect.objectContaining({
				version: 1,
				decision: expect.objectContaining({
					recommendedLevel: expect.any(String),
				}),
				tasks: expect.arrayContaining([
					expect.objectContaining({
						id: "T1",
						inputs: expect.any(Array),
						outputs: expect.any(Array),
					}),
				]),
				acceptancePlan: expect.any(Array),
			}),
		})
	})

	it("persists and broadcasts a task status update with a revision", async () => {
		const plan = {
			version: 1,
			revision: 1,
			source: "generated",
			updatedAt: "2026-07-30T00:00:00.000Z",
			title: "Stylized outline",
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
			tasks: [
				{
					id: "T1",
					kind: "spike",
					title: "Validate",
					owner: "graphics",
					status: "pending",
					inputs: [],
					outputs: [],
					dependsOn: [],
					completionConditions: [],
				},
			],
			acceptancePlan: [],
			generatedAt: "2026-07-30T00:00:00.000Z",
		} satisfies GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		const handled = await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeatureTaskStatus",
			graphicsFeatureTaskId: "T1",
			graphicsFeatureTaskStatus: "completed",
			graphicsFeatureTaskStatusNote: "Prototype approved",
			graphicsFeaturePlanRevision: 1,
		})

		expect(handled).toBe(true)
		expect(workspaceState.update).toHaveBeenCalledWith(
			"graphicsFeaturePlan",
			expect.objectContaining({
				revision: 2,
				source: "workspace",
				tasks: [
					expect.objectContaining({
						id: "T1",
						status: "completed",
						statusNote: "Prototype approved",
					}),
				],
			}),
		)
		expect(postMessageToWebview).toHaveBeenCalledWith({
			type: "graphicsFeaturePlanUpdated",
			graphicsFeaturePlan: expect.objectContaining({ revision: 2 }),
		})
	})

	it("persists a manual task title and completion condition edit", async () => {
		const plan = {
			version: 1,
			revision: 1,
			source: "generated",
			updatedAt: "2026-07-30T00:00:00.000Z",
			title: "Stylized outline",
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
			tasks: [
				{
					id: "T1",
					kind: "spike",
					title: "Validate",
					owner: "graphics",
					status: "pending",
					inputs: [],
					outputs: [],
					dependsOn: [],
					completionConditions: ["Original condition"],
				},
			],
			acceptancePlan: [],
			generatedAt: "2026-07-30T00:00:00.000Z",
		} satisfies GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeatureTask",
			graphicsFeatureTaskId: "T1",
			graphicsFeatureTaskTitle: "Validate on target device",
			graphicsFeatureTaskCompletionConditions: ["Run Vulkan capture", "Record GPU timing"],
			graphicsFeaturePlanRevision: 1,
		})

		expect(workspaceState.update).toHaveBeenCalledWith(
			"graphicsFeaturePlan",
			expect.objectContaining({
				revision: 2,
				source: "manual",
				tasks: [
					expect.objectContaining({
						id: "T1",
						title: "Validate on target device",
						completionConditions: ["Run Vulkan capture", "Record GPU timing"],
					}),
				],
			}),
		)
		expect(postMessageToWebview).toHaveBeenCalledWith({
			type: "graphicsFeaturePlanEdited",
			graphicsFeaturePlan: expect.objectContaining({ revision: 2 }),
		})
	})

	it("persists a manual plan title and summary edit", async () => {
		const plan = {
			version: 1,
			revision: 1,
			source: "generated",
			title: "Original title",
			briefSummary: "Original summary",
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeaturePlan",
			graphicsFeaturePlanTitle: "Edited title",
			graphicsFeaturePlanBriefSummary: "Edited summary",
			graphicsFeaturePlanRevision: 1,
		})

		expect(workspaceState.update).toHaveBeenCalledWith(
			"graphicsFeaturePlan",
			expect.objectContaining({
				revision: 2,
				source: "manual",
				title: "Edited title",
				briefSummary: "Edited summary",
			}),
		)
		expect(postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "graphicsFeaturePlanEdited",
				graphicsFeaturePlan: expect.objectContaining({ revision: 2 }),
			}),
		)
	})

	it("persists a manual pipeline plan section edit and normalizes details", async () => {
		const plan = {
			version: 1,
			revision: 1,
			source: "generated",
			pipelineDesign: {
				summary: "Original pipeline",
				details: ["Original detail"],
			},
			shaderDesign: { summary: "Shader", details: [] },
			clientDesign: { summary: "Client", details: [] },
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeaturePlanSection",
			graphicsFeaturePlanSection: "pipelineDesign",
			graphicsFeaturePlanSectionSummary: " Edited pipeline design ",
			graphicsFeaturePlanSectionDetails: [" After opaques ", "", "Before post-processing"],
			graphicsFeaturePlanRevision: 1,
		})

		expect(workspaceState.update).toHaveBeenCalledWith(
			"graphicsFeaturePlan",
			expect.objectContaining({
				revision: 2,
				source: "manual",
				pipelineDesign: {
					summary: "Edited pipeline design",
					details: ["After opaques", "Before post-processing"],
				},
			}),
		)
		expect(postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "graphicsFeaturePlanEdited",
				graphicsFeaturePlan: expect.objectContaining({ revision: 2 }),
			}),
		)
	})

	it("persists asset contract and performance budget edits", async () => {
		const plan = {
			version: 1,
			revision: 1,
			source: "generated",
			assetContract: {
				requirements: ["Original requirement"],
				validationRules: ["Original rule"],
			},
			performanceBudget: {
				summary: "Original budget",
				details: ["Original detail"],
			},
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeatureAssetContract",
			graphicsFeatureAssetRequirements: [" Texture atlas ", ""],
			graphicsFeatureAssetValidationRules: [" Valid range "],
			graphicsFeaturePlanRevision: 1,
		})

		expect(workspaceState.update).toHaveBeenCalledWith(
			"graphicsFeaturePlan",
			expect.objectContaining({
				revision: 2,
				source: "manual",
				assetContract: {
					requirements: ["Texture atlas"],
					validationRules: ["Valid range"],
				},
			}),
		)

		workspaceState.update.mockClear()
		workspaceState.get.mockReturnValue({ ...plan, revision: 2 })
		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeaturePerformanceBudget",
			graphicsFeaturePerformanceBudgetSummary: " Under 0.5 ms ",
			graphicsFeaturePerformanceBudgetDetails: [" Measure GPU ", ""],
			graphicsFeaturePlanRevision: 2,
		})

		expect(workspaceState.update).toHaveBeenCalledWith(
			"graphicsFeaturePlan",
			expect.objectContaining({
				revision: 3,
				source: "manual",
				performanceBudget: {
					summary: "Under 0.5 ms",
					details: ["Measure GPU"],
				},
			}),
		)
	})

	it("persists decision and compatibility edits with normalization", async () => {
		const plan = {
			version: 1,
			revision: 1,
			source: "generated",
			decision: {
				recommendedLevel: "renderer-pass",
				rationale: ["Original"],
				alternatives: [],
			},
			compatibility: [],
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeatureDecision",
			graphicsFeatureDecisionRationale: [" Prefer pass ", ""],
			graphicsFeatureDecisionAlternatives: [
				{ level: " shader ", reasonNotSelected: " More pipeline risk " },
				{ level: "invalid", reasonNotSelected: " Reject this value " },
				{ level: "compute", reasonNotSelected: " " },
			],
			graphicsFeaturePlanRevision: 1,
		})

		expect(workspaceState.update).toHaveBeenCalledWith(
			"graphicsFeaturePlan",
			expect.objectContaining({
				revision: 2,
				source: "manual",
				decision: {
					recommendedLevel: "renderer-pass",
					rationale: ["Prefer pass"],
					alternatives: [{ level: "shader", reasonNotSelected: "More pipeline risk" }],
				},
			}),
		)

		workspaceState.update.mockClear()
		workspaceState.get.mockReturnValue({ ...plan, revision: 2 })
		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeatureCompatibility",
			graphicsFeatureCompatibility: [
				{ target: " Android ", strategy: " Vulkan ", fallback: " Disable " },
				{ target: "", strategy: "Invalid", fallback: "Ignore" },
			],
			graphicsFeaturePlanRevision: 2,
		})

		expect(workspaceState.update).toHaveBeenCalledWith(
			"graphicsFeaturePlan",
			expect.objectContaining({
				revision: 3,
				source: "manual",
				compatibility: [{ target: "Android", strategy: "Vulkan", fallback: "Disable" }],
			}),
		)
	})

	it("filters invalid planning context enum values before persistence", async () => {
		const plan = createPlan()
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeaturePlanContext",
			graphicsFeatureRisks: [
				{
					id: "R1",
					title: "Risk",
					impact: "invalid" as "high",
					mitigation: "Mitigate",
				},
				{
					id: "R2",
					title: "Valid risk",
					impact: "medium",
					mitigation: "Mitigate",
				},
			],
			graphicsFeatureAcceptancePlan: [
				{
					id: "A1",
					dimension: "invalid" as "visual",
					criterion: "Invalid",
					evidence: "build",
				},
				{
					id: "A2",
					dimension: "performance",
					criterion: "Valid",
					evidence: "invalid" as "build",
				},
				{
					id: "A3",
					dimension: "functional",
					criterion: "Valid",
					evidence: "automated-test",
				},
			],
			graphicsFeaturePlanRevision: 1,
		})

		expect(workspaceState.update).toHaveBeenCalledWith(
			GRAPHICS_FEATURE_PLAN_WORKSPACE_KEY,
			expect.objectContaining({
				risks: [
					{
						id: "R2",
						title: "Valid risk",
						impact: "medium",
						mitigation: "Mitigate",
					},
				],
				acceptancePlan: [
					{
						id: "A3",
						dimension: "functional",
						criterion: "Valid",
						evidence: "automated-test",
					},
				],
			}),
		)
	})

	it("persists planning context and validation edits with normalization", async () => {
		const plan = {
			version: 1,
			revision: 1,
			source: "generated",
			projectContext: ["Original context"],
			openQuestions: ["Original question"],
			risks: [],
			acceptancePlan: [],
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeaturePlanContext",
			graphicsFeatureProjectContext: [" Unity URP ", ""],
			graphicsFeatureOpenQuestions: [" Confirm Android fallback ", ""],
			graphicsFeatureRisks: [
				{
					id: " R1 ",
					title: " Ordering ",
					impact: "high",
					mitigation: " Prototype ",
					reviewGate: " Review before merge ",
				},
				{ id: "", title: "Invalid", impact: "low", mitigation: "" },
			],
			graphicsFeatureAcceptancePlan: [
				{
					id: " A1 ",
					dimension: "visual",
					criterion: " Matches reference ",
					evidence: "screenshot",
				},
				{
					id: "",
					dimension: "functional",
					criterion: "Invalid",
					evidence: "build",
				},
			],
			graphicsFeaturePlanRevision: 1,
		})

		expect(workspaceState.update).toHaveBeenCalledWith(
			"graphicsFeaturePlan",
			expect.objectContaining({
				revision: 2,
				source: "manual",
				projectContext: ["Unity URP"],
				openQuestions: ["Confirm Android fallback"],
				risks: [
					{
						id: "R1",
						title: "Ordering",
						impact: "high",
						mitigation: "Prototype",
						reviewGate: "Review before merge",
					},
				],
				acceptancePlan: [
					{
						id: "A1",
						dimension: "visual",
						criterion: "Matches reference",
						evidence: "screenshot",
					},
				],
			}),
		)
	})

	it("rejects stale planning context edits", async () => {
		const plan = {
			version: 1,
			revision: 3,
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeaturePlanContext",
			graphicsFeatureProjectContext: ["Outdated"],
			graphicsFeaturePlanRevision: 2,
		})

		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "graphicsFeaturePlanConflict",
				graphicsFeaturePlan: plan,
			}),
		)
	})

	it("rejects missing planning context fields", async () => {
		const plan = {
			version: 1,
			revision: 1,
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeaturePlanContext",
		})

		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(log).toHaveBeenCalledWith("[Graphics] updateGraphicsFeaturePlanContext: missing or invalid fields")
	})

	it("rejects stale decision and compatibility edits", async () => {
		const plan = {
			version: 1,
			revision: 3,
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeatureDecision",
			graphicsFeatureDecisionRationale: ["Outdated"],
			graphicsFeaturePlanRevision: 2,
		})
		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "graphicsFeaturePlanConflict",
				graphicsFeaturePlan: plan,
			}),
		)

		postMessageToWebview.mockClear()
		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeatureCompatibility",
			graphicsFeatureCompatibility: [],
			graphicsFeaturePlanRevision: 2,
		})
		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "graphicsFeaturePlanConflict",
				graphicsFeaturePlan: plan,
			}),
		)
	})

	it("rejects missing decision and compatibility fields", async () => {
		const plan = {
			version: 1,
			revision: 1,
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeatureDecision",
		})
		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeatureCompatibility",
		})

		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(log).toHaveBeenCalledWith("[Graphics] updateGraphicsFeatureDecision: missing or invalid fields")
		expect(log).toHaveBeenCalledWith("[Graphics] updateGraphicsFeatureCompatibility: missing or invalid fields")
	})

	it("rejects a stale performance budget edit", async () => {
		const plan = {
			revision: 3,
			version: 1,
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeaturePerformanceBudget",
			graphicsFeaturePerformanceBudgetSummary: "Outdated budget",
			graphicsFeaturePlanRevision: 2,
		})

		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "graphicsFeaturePlanConflict",
				graphicsFeaturePlan: plan,
			}),
		)
	})

	it("rejects an asset contract edit when both fields are missing", async () => {
		const plan = {
			revision: 1,
			version: 1,
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeatureAssetContract",
		})

		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(log).toHaveBeenCalledWith("[Graphics] updateGraphicsFeatureAssetContract: missing or invalid fields")
	})

	it("rejects a stale plan section edit and returns the current plan", async () => {
		const plan = {
			revision: 3,
			version: 1,
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeaturePlanSection",
			graphicsFeaturePlanSection: "shaderDesign",
			graphicsFeaturePlanSectionSummary: "Outdated edit",
			graphicsFeaturePlanRevision: 2,
		})

		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "graphicsFeaturePlanConflict",
				graphicsFeaturePlan: plan,
			}),
		)
	})

	it("ignores invalid plan section edits", async () => {
		const plan = {
			revision: 1,
			version: 1,
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeaturePlanSection",
			graphicsFeaturePlanSection: "performanceBudget" as "pipelineDesign",
			graphicsFeaturePlanRevision: 1,
		})

		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(postMessageToWebview).not.toHaveBeenCalled()
		expect(log).toHaveBeenCalledWith(
			"[Graphics] updateGraphicsFeaturePlanSection: missing or invalid section fields",
		)
	})

	it("rejects a plan section edit when both editable fields are missing", async () => {
		const plan = {
			revision: 1,
			version: 1,
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeaturePlanSection",
			graphicsFeaturePlanSection: "clientDesign",
			graphicsFeaturePlanRevision: 1,
		})

		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(postMessageToWebview).not.toHaveBeenCalled()
		expect(log).toHaveBeenCalledWith(
			"[Graphics] updateGraphicsFeaturePlanSection: missing or invalid section fields",
		)
	})

	it("rejects a stale manual task edit and returns the current plan", async () => {
		const plan = {
			revision: 3,
			version: 1,
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeatureTask",
			graphicsFeatureTaskId: "T1",
			graphicsFeatureTaskTitle: "Outdated edit",
			graphicsFeaturePlanRevision: 2,
		})

		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "graphicsFeaturePlanConflict",
				graphicsFeaturePlan: plan,
			}),
		)
	})

	it("rejects a stale task status update and returns the current plan", async () => {
		const plan = {
			revision: 3,
			version: 1,
			tasks: [],
		} as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeatureTaskStatus",
			graphicsFeatureTaskId: "T1",
			graphicsFeatureTaskStatus: "completed",
			graphicsFeaturePlanRevision: 2,
		})

		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "graphicsFeaturePlanConflict",
				graphicsFeaturePlan: plan,
			}),
		)
	})

	it("queues an executable task and persists its executor metadata", async () => {
		const plan = {
			...createPlan(),
			revision: 1,
			tasks: [
				{
					id: "T1",
					kind: "shader",
					title: "Implement outline",
					owner: "graphics",
					status: "pending",
					inputs: [],
					outputs: [],
					dependsOn: [],
					completionConditions: ["Shader compiles"],
				},
			],
		} satisfies GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "executeGraphicsFeatureTask",
			graphicsFeatureTaskId: "T1",
			graphicsFeatureTaskExecutor: "human",
			graphicsFeatureTaskRole: "technical-art",
		})

		expect(workspaceState.update).toHaveBeenCalledWith(
			GRAPHICS_FEATURE_PLAN_WORKSPACE_KEY,
			expect.objectContaining({
				revision: 2,
				executions: [
					expect.objectContaining({
						taskId: "T1",
						executor: "human",
						role: "technical-art",
						status: "queued",
					}),
				],
				tasks: [expect.objectContaining({ id: "T1", status: "in-progress" })],
			}),
		)
	})

	it("does not execute a task while a dependency is incomplete", async () => {
		const plan = {
			...createPlan(),
			tasks: [
				{
					id: "T1",
					kind: "spike",
					title: "Prerequisite",
					owner: "graphics",
					status: "pending",
					inputs: [],
					outputs: [],
					dependsOn: [],
					completionConditions: [],
				},
				{
					id: "T2",
					kind: "shader",
					title: "Blocked implementation",
					owner: "graphics",
					status: "pending",
					inputs: [],
					outputs: [],
					dependsOn: ["T1"],
					completionConditions: [],
				},
			],
		} satisfies GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "executeGraphicsFeatureTask",
			graphicsFeatureTaskId: "T2",
		})

		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(log).toHaveBeenCalledWith(
			"[Graphics] executeGraphicsFeatureTask: task is missing or blocked by dependencies",
		)
	})

	it("rejects execution when the shared plan snapshot is stale", async () => {
		const workspacePath = await mkdtemp(path.join(os.tmpdir(), "vertex-graphics-handler-execution-"))
		try {
			const plan = {
				...createPlan(),
				revision: 1,
				tasks: [
					{
						id: "T1",
						kind: "shader",
						title: "Implement outline",
						owner: "graphics",
						status: "pending",
						inputs: [],
						outputs: [],
						dependsOn: [],
						completionConditions: [],
					},
				],
			} satisfies GraphicsFeaturePlan
			const storeDirectory = path.join(workspacePath, ".roo", "graphics")
			await mkdir(storeDirectory, { recursive: true })
			await writeFile(path.join(storeDirectory, "feature-plan.json"), JSON.stringify(plan), "utf8")
			const sharedPlan = { ...plan, revision: 2, title: "Changed elsewhere" }
			await writeFile(path.join(storeDirectory, "feature-plan.json"), JSON.stringify(sharedPlan), "utf8")

			await handleGraphicsMessage(createWorkspaceProvider(workspacePath), {
				type: "executeGraphicsFeatureTask",
				graphicsFeatureTaskId: "T1",
			})

			expect(postMessageToWebview).toHaveBeenCalledWith(
				expect.objectContaining({ type: "graphicsFeaturePlanEdited" }),
			)
		} finally {
			// Windows can briefly retain the atomic-write directory entry after the
			// handler has completed; retry cleanup instead of failing the assertion.
			await removeWorkspaceWithRetry(workspacePath)
		}
	})

	it("rejects a plan request without a supported brief", async () => {
		const handled = await handleGraphicsMessage(provider, {
			type: "requestGraphicsFeaturePlan",
		})

		expect(handled).toBe(true)
		expect(postMessageToWebview).not.toHaveBeenCalled()
		expect(log).toHaveBeenCalledWith("[Graphics] requestGraphicsFeaturePlan: missing or unsupported brief")
	})

	it("rejects a recommendation request without a supported brief", async () => {
		const handled = await handleGraphicsMessage(provider, {
			type: "requestGraphicsSolutionRecommendation",
		})

		expect(handled).toBe(true)
		expect(postMessageToWebview).not.toHaveBeenCalled()
		expect(log).toHaveBeenCalledWith(
			"[Graphics] requestGraphicsSolutionRecommendation: missing or unsupported brief",
		)
	})

	it("returns a profile warning when no workspace is open", async () => {
		const handled = await handleGraphicsMessage(provider, {
			type: "requestGraphicsProjectProfile",
		})

		expect(handled).toBe(true)
		expect(postMessageToWebview).toHaveBeenCalledWith({
			type: "graphicsProjectProfile",
			graphicsProjectProfile: expect.objectContaining({
				engine: "unknown",
				workspaceName: "No workspace",
				warnings: ["Open a workspace to generate a Graphics Project Profile."],
			}),
		})
	})
})
