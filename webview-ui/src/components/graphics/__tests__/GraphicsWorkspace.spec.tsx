import React from "react"
import { act, fireEvent, render, screen } from "@/utils/test-utils"

import GraphicsWorkspace from "../GraphicsWorkspace"
import { vscode } from "@src/utils/vscode"

const webviewState: { current: Record<string, unknown> | undefined } = { current: undefined }

const createBrief = (title: string) => ({
	version: 1 as const,
	title,
	visualGoal: "",
	lifecycle: "",
	artControls: "",
	targetPlatforms: "",
	performanceBudget: "",
	compatibilityRequirements: "",
	acceptanceCriteria: "",
})

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
		getState: vi.fn(() => webviewState.current),
		setState: vi.fn((state: Record<string, unknown>) => {
			webviewState.current = state
			return state
		}),
	},
}))

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({ renderContext: "sidebar" }),
}))

describe("GraphicsWorkspace", () => {
	beforeEach(() => {
		webviewState.current = undefined
		vi.clearAllMocks()
	})

	it("renders provider-independent feature planning and requests the workspace brief", () => {
		render(<GraphicsWorkspace onDone={vi.fn()} />)

		expect(screen.getByTestId("graphics-feature-home")).toBeInTheDocument()
		expect(screen.getByText("Feature planning")).toBeInTheDocument()
		expect(screen.getByText("Project source analysis")).toBeInTheDocument()
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "requestGraphicsFeatureBrief" })
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "requestGraphicsFeaturePlanRecovery" })
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "requestGraphicsProjectProfile" })
		expect(screen.getByText("Inspecting project graphics architecture…")).toBeInTheDocument()
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "requestGraphicsFeaturePlanRecovery" })
		expect(vscode.postMessage).not.toHaveBeenCalledWith({ type: "requestGraphicsProviderStatus" })
	})

	it("edits and persists the feature brief without replacing unrelated webview state", () => {
		webviewState.current = { existingPreference: "preserved" }
		render(<GraphicsWorkspace onDone={vi.fn()} />)

		fireEvent.change(screen.getByLabelText("Feature title"), { target: { value: "Stylized outline" } })
		fireEvent.change(screen.getByLabelText("Acceptance criteria"), {
			target: { value: "Outline remains stable at target resolution." },
		})
		fireEvent.click(screen.getByRole("button", { name: "Save feature brief" }))

		expect(vscode.setState).toHaveBeenCalledWith(
			expect.objectContaining({
				existingPreference: "preserved",
				graphicsWorkspace: expect.objectContaining({
					featureBrief: expect.objectContaining({
						title: "Stylized outline",
						acceptanceCriteria: "Outline remains stable at target resolution.",
						version: 1,
						updatedAt: expect.any(String),
					}),
				}),
			}),
		)
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "saveGraphicsFeatureBrief",
			graphicsFeatureBrief: expect.objectContaining({
				title: "Stylized outline",
				updatedAt: expect.any(String),
			}),
		})
		expect(screen.getByRole("button", { name: "Save feature brief" })).toHaveTextContent("Saved")
	})

	it("restores a persisted feature brief when the workspace remounts", () => {
		webviewState.current = {
			graphicsWorkspace: {
				featureBrief: {
					version: 1,
					title: "Volumetric fog",
					visualGoal: "Layered cinematic depth",
					lifecycle: "",
					artControls: "",
					targetPlatforms: "",
					performanceBudget: "",
					compatibilityRequirements: "",
					acceptanceCriteria: "",
				},
			},
		}

		render(<GraphicsWorkspace onDone={vi.fn()} />)

		expect(screen.getByLabelText("Feature title")).toHaveValue("Volumetric fog")
		expect(screen.getByLabelText("Visual goal")).toHaveValue("Layered cinematic depth")
		expect(vscode.postMessage).not.toHaveBeenCalledWith({ type: "requestGraphicsProviderStatus" })
	})

	it("uses the workspace brief as the source of truth and caches it locally", () => {
		webviewState.current = {
			existingPreference: "preserved",
			graphicsWorkspace: {
				featureBrief: { ...createBrief("Local draft"), updatedAt: "2026-07-29T00:00:00.000Z" },
			},
		}
		render(<GraphicsWorkspace onDone={vi.fn()} />)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "graphicsFeatureBrief",
						graphicsFeatureBrief: {
							...createBrief("Workspace brief"),
							updatedAt: "2026-07-30T00:00:00.000Z",
						},
					},
				}),
			)
		})

		expect(screen.getByLabelText("Feature title")).toHaveValue("Workspace brief")
		expect(vscode.setState).toHaveBeenLastCalledWith(
			expect.objectContaining({
				existingPreference: "preserved",
				graphicsWorkspace: expect.objectContaining({
					featureBrief: expect.objectContaining({ title: "Workspace brief" }),
				}),
			}),
		)
	})

	it("migrates a timestamped local draft when the workspace has no brief", () => {
		const localBrief = { ...createBrief("Legacy local draft"), updatedAt: "2026-07-30T00:00:00.000Z" }
		webviewState.current = { graphicsWorkspace: { featureBrief: localBrief } }
		render(<GraphicsWorkspace onDone={vi.fn()} />)

		act(() => {
			window.dispatchEvent(new MessageEvent("message", { data: { type: "graphicsFeatureBrief" } }))
		})

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "saveGraphicsFeatureBrief",
			graphicsFeatureBrief: localBrief,
		})
	})

	it("requests and renders an explainable solution recommendation", () => {
		render(<GraphicsWorkspace onDone={vi.fn()} />)
		fireEvent.change(screen.getByLabelText("Feature title"), { target: { value: "Fullscreen outline" } })
		fireEvent.change(screen.getByLabelText("Visual goal"), { target: { value: "Use depth and normals" } })
		fireEvent.click(screen.getByRole("button", { name: "Generate solution recommendation" }))

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "requestGraphicsSolutionRecommendation",
			graphicsFeatureBrief: expect.objectContaining({
				title: "Fullscreen outline",
				visualGoal: "Use depth and normals",
			}),
		})
		expect(screen.getByText("Evaluating implementation levels…")).toBeInTheDocument()

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "graphicsSolutionRecommendation",
						graphicsSolutionRecommendation: {
							version: 1,
							recommendedLevel: "renderer-pass",
							summary: "Renderer pass is the current lowest-risk fit.",
							candidates: [
								{
									level: "renderer-pass",
									label: "Renderer Feature or custom render pass",
									score: 48,
									confidence: "high",
									reasons: ["The project already exposes a renderer feature."],
									risks: [],
									rejectionReasons: [],
								},
							],
							assumptions: ["No explicit performance budget was provided."],
							generatedAt: "2026-07-30T00:00:00.000Z",
						},
					},
				}),
			)
		})

		expect(screen.getByText("Recommended: Renderer Feature or custom render pass")).toBeInTheDocument()
		expect(screen.getByText("Renderer pass is the current lowest-risk fit.")).toBeInTheDocument()
		expect(screen.getByText("No explicit performance budget was provided.")).toBeInTheDocument()
	})

	it("requests and renders a dependency-ordered cross-module feature plan", () => {
		render(<GraphicsWorkspace onDone={vi.fn()} />)
		fireEvent.change(screen.getByLabelText("Feature title"), { target: { value: "Fullscreen outline" } })
		fireEvent.click(screen.getByRole("button", { name: "Generate solution recommendation" }))
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "graphicsSolutionRecommendation",
						graphicsSolutionRecommendation: {
							version: 1,
							recommendedLevel: "renderer-pass",
							summary: "Renderer pass.",
							candidates: [
								{
									level: "renderer-pass",
									label: "Renderer pass",
									score: 40,
									confidence: "high",
									reasons: ["Supported"],
									risks: [],
									rejectionReasons: [],
								},
							],
							assumptions: [],
							generatedAt: "2026-07-30T00:00:00.000Z",
						},
					},
				}),
			)
		})

		fireEvent.click(screen.getByRole("button", { name: "Generate cross-module feature plan" }))
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "requestGraphicsFeaturePlan",
			graphicsFeatureBrief: expect.objectContaining({ title: "Fullscreen outline" }),
		})
		expect(screen.getByText("Generating cross-module feature plan…")).toBeInTheDocument()

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "graphicsFeaturePlan",
						graphicsFeaturePlan: {
							version: 1,
							revision: 1,
							source: "generated",
							updatedAt: "2026-07-30T00:00:00.000Z",
							title: "Fullscreen outline",
							briefSummary: "Readable outline",
							openQuestions: [],
							projectContext: ["SampleGame"],
							decision: {
								recommendedLevel: "renderer-pass",
								rationale: ["Existing pass"],
								alternatives: [],
							},
							pipelineDesign: { summary: "Add a dedicated pass.", details: ["After opaques"] },
							shaderDesign: { summary: "Fullscreen shader.", details: ["Depth and normals"] },
							clientDesign: { summary: "Scoped lifecycle.", details: ["Enable and disable"] },
							assetContract: { requirements: ["Width and color"], validationRules: ["Valid ranges"] },
							performanceBudget: { summary: "Under 0.4 ms", details: ["Measure GPU"] },
							compatibility: [{ target: "Android", strategy: "Vulkan", fallback: "Disable" }],
							risks: [
								{
									id: "R1",
									title: "Ordering",
									impact: "high",
									mitigation: "Prototype",
									reviewGate: "Review pass ordering before merge.",
								},
							],
							tasks: [
								{
									id: "T1",
									kind: "spike",
									status: "pending",
									title: "Validate architecture",
									owner: "graphics",
									inputs: ["Brief"],
									outputs: ["Decision"],
									dependsOn: [],
									completionConditions: ["Approved"],
								},
								{
									id: "T2",
									kind: "validation",
									status: "pending",
									title: "Validate feature",
									owner: "qa",
									inputs: ["Feature"],
									outputs: ["Evidence"],
									dependsOn: ["T1"],
									completionConditions: ["Passed"],
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
							generatedAt: "2026-07-30T00:00:00.000Z",
						},
					},
				}),
			)
		})

		expect(
			screen.getByText("Decision: renderer-pass · 2 dependency-ordered tasks · revision 1"),
		).toBeInTheDocument()
		expect(screen.getByLabelText("T2 title")).toHaveValue("Validate feature")
		expect(screen.getByText(/Depends on: T1/)).toBeInTheDocument()
		const planTitle = screen.getByLabelText("Feature plan title")
		fireEvent.change(planTitle, { target: { value: "Android outline implementation" } })
		fireEvent.blur(planTitle)
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateGraphicsFeaturePlan",
			graphicsFeaturePlanTitle: "Android outline implementation",
			graphicsFeaturePlanBriefSummary: "Readable outline",
			graphicsFeaturePlanRevision: 1,
		})

		const planSummary = screen.getByLabelText("Feature plan summary")
		fireEvent.change(planSummary, { target: { value: "Validated outline for Android Vulkan" } })
		fireEvent.blur(planSummary)
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateGraphicsFeaturePlan",
			graphicsFeaturePlanTitle: "Android outline implementation",
			graphicsFeaturePlanBriefSummary: "Validated outline for Android Vulkan",
			graphicsFeaturePlanRevision: 1,
		})

		const decisionRationale = screen.getByLabelText("Decision rationale")
		fireEvent.change(decisionRationale, { target: { value: "Prefer existing pass\nAvoid pipeline fork" } })
		fireEvent.blur(decisionRationale)
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateGraphicsFeatureDecision",
			graphicsFeatureDecisionRationale: ["Prefer existing pass", "Avoid pipeline fork"],
			graphicsFeatureDecisionAlternatives: [],
			graphicsFeaturePlanRevision: 1,
		})

		const decisionAlternatives = screen.getByLabelText("Decision alternatives")
		fireEvent.change(decisionAlternatives, { target: { value: "shader | Avoid extra variant" } })
		fireEvent.blur(decisionAlternatives)
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateGraphicsFeatureDecision",
			graphicsFeatureDecisionRationale: ["Prefer existing pass", "Avoid pipeline fork"],
			graphicsFeatureDecisionAlternatives: [{ level: "shader", reasonNotSelected: "Avoid extra variant" }],
			graphicsFeaturePlanRevision: 1,
		})

		const compatibilityTargets = screen.getByLabelText("Compatibility targets")
		fireEvent.change(compatibilityTargets, { target: { value: "Android | Vulkan | Disable\nPC | DX12 | Full" } })
		fireEvent.blur(compatibilityTargets)
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateGraphicsFeatureCompatibility",
			graphicsFeatureCompatibility: [
				{ target: "Android", strategy: "Vulkan", fallback: "Disable" },
				{ target: "PC", strategy: "DX12", fallback: "Full" },
			],
			graphicsFeaturePlanRevision: 1,
		})

		const performanceSummary = screen.getByLabelText("Performance budget summary")
		fireEvent.change(performanceSummary, { target: { value: "Under 0.5 ms" } })
		fireEvent.blur(performanceSummary)
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateGraphicsFeaturePerformanceBudget",
			graphicsFeaturePerformanceBudgetSummary: "Under 0.5 ms",
			graphicsFeaturePerformanceBudgetDetails: ["Measure GPU"],
			graphicsFeaturePlanRevision: 1,
		})

		const assetRequirements = screen.getByLabelText("Asset requirements")
		fireEvent.change(assetRequirements, { target: { value: "Width and color\nTexture atlas" } })
		fireEvent.blur(assetRequirements)
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateGraphicsFeatureAssetContract",
			graphicsFeatureAssetRequirements: ["Width and color", "Texture atlas"],
			graphicsFeatureAssetValidationRules: ["Valid ranges"],
			graphicsFeaturePlanRevision: 1,
		})

		const pipelineSummary = screen.getByLabelText("Pipeline summary")
		fireEvent.change(pipelineSummary, { target: { value: "Edited pipeline design" } })
		fireEvent.blur(pipelineSummary)
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateGraphicsFeaturePlanSection",
			graphicsFeaturePlanSection: "pipelineDesign",
			graphicsFeaturePlanSectionSummary: "Edited pipeline design",
			graphicsFeaturePlanSectionDetails: ["After opaques"],
			graphicsFeaturePlanRevision: 1,
		})

		const shaderDetails = screen.getByLabelText("Shader details")
		fireEvent.change(shaderDetails, { target: { value: "Read depth\nSample normals" } })
		fireEvent.blur(shaderDetails)
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateGraphicsFeaturePlanSection",
			graphicsFeaturePlanSection: "shaderDesign",
			graphicsFeaturePlanSectionSummary: "Fullscreen shader.",
			graphicsFeaturePlanSectionDetails: ["Read depth", "Sample normals"],
			graphicsFeaturePlanRevision: 1,
		})

		const clientSummary = screen.getByLabelText("Client lifecycle summary")
		fireEvent.change(clientSummary, { target: { value: "Edited client lifecycle" } })
		fireEvent.blur(clientSummary)
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateGraphicsFeaturePlanSection",
			graphicsFeaturePlanSection: "clientDesign",
			graphicsFeaturePlanSectionSummary: "Edited client lifecycle",
			graphicsFeaturePlanSectionDetails: ["Enable and disable"],
			graphicsFeaturePlanRevision: 1,
		})

		const projectContext = screen.getByLabelText("Project context")
		fireEvent.change(projectContext, { target: { value: "Unity URP\nAndroid Vulkan" } })
		fireEvent.blur(projectContext)
		expect(vscode.postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				type: "updateGraphicsFeaturePlanContext",
				graphicsFeatureProjectContext: ["Unity URP", "Android Vulkan"],
				graphicsFeatureOpenQuestions: [""],
				graphicsFeaturePlanRevision: 1,
			}),
		)

		const planRisks = screen.getByLabelText("Plan risks")
		fireEvent.change(planRisks, { target: { value: "R1 | Ordering | high | Prototype | Review before merge" } })
		fireEvent.blur(planRisks)
		expect(vscode.postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				type: "updateGraphicsFeaturePlanContext",
				graphicsFeatureRisks: [
					{
						id: "R1",
						title: "Ordering",
						impact: "high",
						mitigation: "Prototype",
						reviewGate: "Review before merge",
					},
				],
			}),
		)

		const acceptancePlan = screen.getByLabelText("Acceptance plan")
		fireEvent.change(acceptancePlan, { target: { value: "A1 | visual | Matches reference | screenshot" } })
		fireEvent.blur(acceptancePlan)
		expect(vscode.postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				type: "updateGraphicsFeaturePlanContext",
				graphicsFeatureAcceptancePlan: [
					{ id: "A1", dimension: "visual", criterion: "Matches reference", evidence: "screenshot" },
				],
			}),
		)

		const taskTitle = screen.getByLabelText("T2 title")
		fireEvent.change(taskTitle, { target: { value: "Validate on Android" } })
		fireEvent.blur(taskTitle)
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateGraphicsFeatureTask",
			graphicsFeatureTaskId: "T2",
			graphicsFeatureTaskTitle: "Validate on Android",
			graphicsFeatureTaskCompletionConditions: ["Passed"],
			graphicsFeaturePlanRevision: 1,
		})

		const completionConditions = screen.getByLabelText("T2 completion conditions")
		fireEvent.change(completionConditions, { target: { value: "Capture frame\nVerify GPU timing" } })
		fireEvent.blur(completionConditions)
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateGraphicsFeatureTask",
			graphicsFeatureTaskId: "T2",
			graphicsFeatureTaskTitle: "Validate on Android",
			graphicsFeatureTaskCompletionConditions: ["Capture frame", "Verify GPU timing"],
			graphicsFeaturePlanRevision: 1,
		})
		expect(screen.getByText("Review pass ordering before merge.")).toBeInTheDocument()
		const status = screen.getByLabelText("T2 status")
		expect(status).toHaveValue("pending")
		fireEvent.change(status, { target: { value: "completed" } })
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateGraphicsFeatureTaskStatus",
			graphicsFeatureTaskId: "T2",
			graphicsFeatureTaskStatus: "completed",
			graphicsFeaturePlanRevision: 1,
		})

		const statusNote = screen.getByLabelText("T2 status note")
		fireEvent.change(statusNote, { target: { value: "Validated on Android Vulkan" } })
		fireEvent.blur(statusNote)
		expect(vscode.postMessage).toHaveBeenLastCalledWith({
			type: "updateGraphicsFeatureTaskStatus",
			graphicsFeatureTaskId: "T2",
			graphicsFeatureTaskStatus: "completed",
			graphicsFeatureTaskStatusNote: "Validated on Android Vulkan",
			graphicsFeaturePlanRevision: 1,
		})

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "graphicsFeaturePlanUpdated",
						graphicsFeaturePlan: {
							version: 1,
							revision: 2,
							source: "workspace",
							updatedAt: "2026-07-30T00:01:00.000Z",
							title: "Fullscreen outline",
							briefSummary: "Readable outline",
							openQuestions: [],
							projectContext: ["SampleGame"],
							decision: {
								recommendedLevel: "renderer-pass",
								rationale: ["Existing pass"],
								alternatives: [],
							},
							pipelineDesign: { summary: "Add a dedicated pass.", details: ["After opaques"] },
							shaderDesign: { summary: "Fullscreen shader.", details: ["Depth and normals"] },
							clientDesign: { summary: "Scoped lifecycle.", details: ["Enable and disable"] },
							assetContract: { requirements: ["Width and color"], validationRules: ["Valid ranges"] },
							performanceBudget: { summary: "Under 0.4 ms", details: ["Measure GPU"] },
							compatibility: [{ target: "Android", strategy: "Vulkan", fallback: "Disable" }],
							risks: [],
							tasks: [],
							acceptancePlan: [],
							generatedAt: "2026-07-30T00:00:00.000Z",
						},
					},
				}),
			)
		})
	})

	it("renders the detected project profile and supports refresh", () => {
		render(<GraphicsWorkspace onDone={vi.fn()} />)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "graphicsProjectProfile",
						graphicsProjectProfile: {
							version: 1,
							workspaceName: "SampleGame",
							engine: "unity",
							engineVersion: "2022.3.48f1",
							renderPipelines: ["Unity URP"],
							graphicsApis: ["Vulkan"],
							targetPlatforms: ["Android"],
							shaderLanguages: ["ShaderLab/HLSL"],
							architectureSignals: ["Renderer Feature / Scriptable Render Pass"],
							architectureIndex: {
								version: 1,
								analyzedFileCount: 4,
								truncated: false,
								findings: [
									{
										category: "pass",
										path: "Assets/Rendering/OutlineRendererFeature.cs",
										kind: "pass-injection-point",
										symbol: "AfterRenderingOpaques",
										detail: "Injects a render pass at RenderPassEvent.AfterRenderingOpaques.",
									},
								],
							},
							evidence: [{ path: "Packages/manifest.json", description: "Unity package manifest" }],
							warnings: [],
							scannedAt: "2026-07-30T00:00:00.000Z",
						},
					},
				}),
			)
		})

		expect(screen.getByText(/unity 2022\.3\.48f1/i)).toBeInTheDocument()
		expect(screen.getByText(/Unity URP/)).toBeInTheDocument()
		expect(screen.getByText("Renderer Feature / Scriptable Render Pass")).toBeInTheDocument()
		expect(screen.getByText("Packages/manifest.json")).toBeInTheDocument()
		expect(screen.getByText("1 findings from 4 files")).toBeInTheDocument()
		expect(screen.getByText("AfterRenderingOpaques")).toBeInTheDocument()
		expect(screen.getByText("Assets/Rendering/OutlineRendererFeature.cs")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Refresh project profile" }))
		expect(vscode.postMessage).toHaveBeenLastCalledWith({ type: "requestGraphicsProjectProfile" })
	})

	it("requests runtime provider status only after opening the Runtime section", () => {
		render(<GraphicsWorkspace onDone={vi.fn()} />)

		fireEvent.click(screen.getByRole("tab", { name: "Runtime" }))

		expect(screen.getByTestId("graphics-runtime-investigation")).toBeInTheDocument()
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "requestGraphicsProviderStatus" })
	})

	it("keeps the workspace usable when no runtime provider is installed", () => {
		render(<GraphicsWorkspace onDone={vi.fn()} />)
		fireEvent.click(screen.getByRole("tab", { name: "Runtime" }))

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "graphicsProviderStatus",
						values: {
							providers: [],
							capabilitiesByProviderId: {},
						},
					},
				}),
			)
		})

		expect(screen.getByText("Runtime tools are optional")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("tab", { name: "Feature Plan" }))
		expect(screen.getByTestId("graphics-feature-home")).toBeInTheDocument()
	})
})
