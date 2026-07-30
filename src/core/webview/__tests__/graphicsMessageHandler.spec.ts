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

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("loads the workspace Feature Brief and posts it to the webview", async () => {
		const graphicsFeatureBrief = createBrief()
		workspaceState.get.mockReturnValue(graphicsFeatureBrief)

		const handled = await handleGraphicsMessage(provider, { type: "requestGraphicsFeatureBrief" })

		expect(handled).toBe(true)
		expect(workspaceState.get).toHaveBeenCalledWith("graphicsFeatureBrief")
		expect(postMessageToWebview).toHaveBeenCalledWith({ type: "graphicsFeatureBrief", graphicsFeatureBrief })
	})

	it("recovers the persisted Feature Plan without regenerating it", async () => {
		const plan = { revision: 4, version: 1, tasks: [] } as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		const handled = await handleGraphicsMessage(provider, { type: "requestGraphicsFeaturePlanRecovery" })

		expect(handled).toBe(true)
		expect(workspaceState.get).toHaveBeenCalledWith("graphicsFeaturePlan")
		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(postMessageToWebview).toHaveBeenCalledWith({
			type: "graphicsFeaturePlanRecovered",
			graphicsFeaturePlan: plan,
		})
	})

	it("posts an empty response when the workspace has no Feature Brief", async () => {
		workspaceState.get.mockReturnValue(undefined)

		await handleGraphicsMessage(provider, { type: "requestGraphicsFeatureBrief" })

		expect(postMessageToWebview).toHaveBeenCalledWith({
			type: "graphicsFeatureBrief",
			graphicsFeatureBrief: undefined,
		})
	})

	it("saves a supported Feature Brief and confirms it to the webview", async () => {
		const graphicsFeatureBrief = createBrief()
		const message: WebviewMessage = { type: "saveGraphicsFeatureBrief", graphicsFeatureBrief }

		const handled = await handleGraphicsMessage(provider, message)

		expect(handled).toBe(true)
		expect(workspaceState.update).toHaveBeenCalledWith("graphicsFeatureBrief", graphicsFeatureBrief)
		expect(postMessageToWebview).toHaveBeenCalledWith({ type: "graphicsFeatureBrief", graphicsFeatureBrief })
	})

	it("rejects a missing Feature Brief without updating workspace state", async () => {
		const handled = await handleGraphicsMessage(provider, { type: "saveGraphicsFeatureBrief" })

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
				decision: expect.objectContaining({ recommendedLevel: expect.any(String) }),
				tasks: expect.arrayContaining([
					expect.objectContaining({ id: "T1", inputs: expect.any(Array), outputs: expect.any(Array) }),
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
				tasks: [expect.objectContaining({ id: "T1", status: "completed", statusNote: "Prototype approved" })],
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

	it("rejects a stale manual task edit and returns the current plan", async () => {
		const plan = { revision: 3, version: 1, tasks: [] } as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeatureTask",
			graphicsFeatureTaskId: "T1",
			graphicsFeatureTaskTitle: "Outdated edit",
			graphicsFeaturePlanRevision: 2,
		})

		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({ type: "graphicsFeaturePlanConflict", graphicsFeaturePlan: plan }),
		)
	})

	it("rejects a stale task status update and returns the current plan", async () => {
		const plan = { revision: 3, version: 1, tasks: [] } as unknown as GraphicsFeaturePlan
		workspaceState.get.mockReturnValue(plan)

		await handleGraphicsMessage(provider, {
			type: "updateGraphicsFeatureTaskStatus",
			graphicsFeatureTaskId: "T1",
			graphicsFeatureTaskStatus: "completed",
			graphicsFeaturePlanRevision: 2,
		})

		expect(workspaceState.update).not.toHaveBeenCalled()
		expect(postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({ type: "graphicsFeaturePlanConflict", graphicsFeaturePlan: plan }),
		)
	})

	it("rejects a plan request without a supported brief", async () => {
		const handled = await handleGraphicsMessage(provider, { type: "requestGraphicsFeaturePlan" })

		expect(handled).toBe(true)
		expect(postMessageToWebview).not.toHaveBeenCalled()
		expect(log).toHaveBeenCalledWith("[Graphics] requestGraphicsFeaturePlan: missing or unsupported brief")
	})

	it("rejects a recommendation request without a supported brief", async () => {
		const handled = await handleGraphicsMessage(provider, { type: "requestGraphicsSolutionRecommendation" })

		expect(handled).toBe(true)
		expect(postMessageToWebview).not.toHaveBeenCalled()
		expect(log).toHaveBeenCalledWith(
			"[Graphics] requestGraphicsSolutionRecommendation: missing or unsupported brief",
		)
	})

	it("returns a profile warning when no workspace is open", async () => {
		const handled = await handleGraphicsMessage(provider, { type: "requestGraphicsProjectProfile" })

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
