import type {
	GraphicsFeatureAcceptanceCheck,
	GraphicsFeatureBrief,
	GraphicsFeatureCompatibilityTarget,
	GraphicsFeaturePlan,
	GraphicsFeaturePlanSection,
	GraphicsFeatureRisk,
	GraphicsFeatureTask,
	GraphicsProjectProfile,
	GraphicsSolutionLevel,
	GraphicsSolutionRecommendation,
} from "@roo-code/types"

export interface GraphicsFeaturePlannerOptions {
	now?: () => Date
}

const levelDesign: Record<
	GraphicsSolutionLevel,
	{ pipeline: string; shader: string; client: string; risk: string; gate?: string }
> = {
	configuration: {
		pipeline: "Reuse the existing render path without adding a pass.",
		shader: "Prefer existing shader parameters and keywords over new shader variants.",
		client: "Bind existing material or asset controls through the current lifecycle.",
		risk: "Existing controls may not expose the full requested visual range.",
	},
	shader: {
		pipeline:
			"Keep the existing pass topology and material render queue unless prototype evidence requires otherwise.",
		shader: "Implement the visual model in a focused material shader with explicit properties and variant limits.",
		client: "Drive material properties through a scoped property block or equivalent project abstraction.",
		risk: "Shader variants, overdraw, or material instancing can exceed the target budget.",
	},
	"renderer-pass": {
		pipeline:
			"Add a dedicated pass at the narrowest valid injection point and declare all required camera resources.",
		shader: "Use a dedicated pass shader with explicit depth, normal, mask, and sampling requirements.",
		client: "Expose feature enablement and per-camera or per-object registration without owning render resources.",
		risk: "Injection order, camera stacking, and transient render-target lifetime can cause regressions.",
		gate: "Review pass ordering and shared render-target impact before formal implementation.",
	},
	"post-process": {
		pipeline: "Integrate through the existing post-processing or volume extension point.",
		shader: "Implement a fullscreen shader with documented color-space and source-buffer assumptions.",
		client: "Control the effect through volume/profile state and a lifecycle-safe gameplay adapter.",
		risk: "Dynamic resolution, HDR formats, and post-process ordering can change visual output.",
	},
	"render-graph": {
		pipeline:
			"Declare new resources and pass dependencies in Render Graph with explicit lifetime and synchronization.",
		shader: "Keep shader interfaces aligned with graph resource formats and avoid hidden global state.",
		client: "Expose only stable feature controls; graph resources remain owned by the rendering layer.",
		risk: "Core pipeline changes have a broad regression surface across cameras, quality tiers, and platforms.",
		gate: "Require architecture review, rollback design, and target-platform build evidence before merge.",
	},
	compute: {
		pipeline: "Schedule compute work with explicit producer/consumer synchronization and bounded GPU buffers.",
		shader: "Define kernels, thread-group sizing, memory layout, bounds checks, and indirect argument ownership.",
		client: "Own allocation and dispatch lifecycle through a disposable client-facing controller.",
		risk: "Synchronization, memory traffic, and unsupported hardware can invalidate the design.",
		gate: "Require a target-device capability spike and measured prototype before production integration.",
	},
	"cpu-client": {
		pipeline: "Do not modify the render pipeline unless profiling proves the client implementation insufficient.",
		shader: "Reuse existing rendering inputs and keep any shader change limited to data consumption.",
		client: "Implement state, events, pooling, and cleanup in the client lifecycle with deterministic ownership.",
		risk: "Per-frame CPU work or object churn can move the bottleneck outside the graphics pipeline.",
	},
}

function provided(value: string, fallback: string): string {
	return value.trim() || fallback
}

function section(summary: string, ...details: string[]): GraphicsFeaturePlanSection {
	return { summary, details }
}

function buildCompatibility(
	brief: GraphicsFeatureBrief,
	profile: GraphicsProjectProfile,
): GraphicsFeatureCompatibilityTarget[] {
	const targets = [brief.targetPlatforms, ...profile.targetPlatforms, ...profile.graphicsApis]
		.flatMap((value) => value.split(/[,;\n]+/))
		.map((value) => value.trim())
		.filter(Boolean)
	return [...new Set(targets.length > 0 ? targets : ["Target platform to be confirmed"])].map((target) => ({
		target,
		strategy: provided(brief.compatibilityRequirements, `Validate the selected implementation on ${target}.`),
		fallback: "Disable the feature or use the lowest-cost supported quality tier without breaking base rendering.",
	}))
}

function buildTasks(level: GraphicsSolutionLevel, brief: GraphicsFeatureBrief): GraphicsFeatureTask[] {
	const implementationKind =
		level === "cpu-client" ? "client" : level === "shader" || level === "configuration" ? "shader" : "pipeline"
	return [
		{
			id: "T1",
			status: "pending",
			kind: "spike",
			title: "Freeze requirements and validate architecture assumptions",
			owner: "graphics",
			inputs: ["Graphics Feature Brief", "Graphics Project Profile", "Solution Recommendation"],
			outputs: ["Reviewed architecture decision", "Resolved blocking questions"],
			dependsOn: [],
			completionConditions: [
				"Implementation level and integration boundary are approved.",
				"Open blocking questions have owners.",
			],
		},
		{
			id: "T2",
			status: "pending",
			kind: "prototype",
			title: "Build a minimum visual prototype",
			owner: "graphics",
			inputs: ["T1 architecture decision", provided(brief.visualGoal, "Visual target reference")],
			outputs: ["Isolated prototype", "Initial GPU/CPU measurement"],
			dependsOn: ["T1"],
			completionConditions: [
				"The target visual behavior is demonstrated in an isolated scene.",
				"Initial cost is measured.",
			],
		},
		{
			id: "T3",
			status: "pending",
			kind: implementationKind,
			title: `Implement the production ${level} solution`,
			owner: "graphics",
			inputs: ["T2 prototype", "Project rendering conventions"],
			outputs: ["Production rendering implementation", "Debug controls"],
			dependsOn: ["T2"],
			completionConditions: [
				"Implementation follows project ownership and cleanup conventions.",
				"Debug labels and feature toggle are available.",
			],
		},
		{
			id: "T4",
			status: "pending",
			kind: "client",
			title: "Integrate client API and lifecycle",
			owner: "client",
			inputs: ["T3 rendering interface", provided(brief.lifecycle, "Lifecycle contract to be confirmed")],
			outputs: ["Client-facing API", "Lifecycle integration"],
			dependsOn: ["T3"],
			completionConditions: [
				"Enable, update, disable, and cleanup paths are deterministic.",
				"Rendering resources remain graphics-owned.",
			],
		},
		{
			id: "T5",
			status: "pending",
			kind: "asset",
			title: "Author and validate art assets",
			owner: "technical-art",
			inputs: ["T3 shader and property contract", provided(brief.artControls, "Art controls to be confirmed")],
			outputs: ["Compliant assets or templates", "Asset validation results"],
			dependsOn: ["T3"],
			completionConditions: [
				"Required controls have documented ranges and defaults.",
				"Invalid inputs produce actionable validation feedback.",
			],
		},
		{
			id: "T6",
			status: "pending",
			kind: "validation",
			title: "Run visual, functional, performance, and compatibility acceptance",
			owner: "qa",
			inputs: ["T4 integrated feature", "T5 validated assets", "Acceptance plan"],
			outputs: ["Acceptance evidence", "Regression and target-device results"],
			dependsOn: ["T4", "T5"],
			completionConditions: [
				"All acceptance checks have evidence.",
				"Fallback and feature-disable paths are verified.",
			],
		},
		{
			id: "T7",
			status: "pending",
			kind: "delivery",
			title: "Document delivery, rollback, and maintenance ownership",
			owner: "graphics",
			inputs: ["T6 acceptance evidence"],
			outputs: ["Feature documentation", "Rollback procedure", "Ownership record"],
			dependsOn: ["T6"],
			completionConditions: [
				"Delivery documentation links implementation and evidence.",
				"Rollback owner and procedure are explicit.",
			],
		},
	]
}

function buildAcceptance(brief: GraphicsFeatureBrief): GraphicsFeatureAcceptanceCheck[] {
	return [
		{
			id: "A1",
			dimension: "visual",
			criterion: provided(brief.acceptanceCriteria, "Visual output matches the approved reference."),
			evidence: "screenshot",
		},
		{
			id: "A2",
			dimension: "functional",
			criterion: "Enable, update, disable, scene transition, and cleanup paths behave deterministically.",
			evidence: "automated-test",
		},
		{
			id: "A3",
			dimension: "performance",
			criterion: provided(
				brief.performanceBudget,
				"GPU, CPU, memory, and bandwidth cost must be measured and approved.",
			),
			evidence: "profiler",
		},
		{
			id: "A4",
			dimension: "compatibility",
			criterion: provided(
				brief.compatibilityRequirements,
				"All declared targets build and execute with a verified fallback.",
			),
			evidence: "device-test",
		},
	]
}

export function createGraphicsFeaturePlan(
	brief: GraphicsFeatureBrief,
	profile: GraphicsProjectProfile,
	recommendation: GraphicsSolutionRecommendation,
	options: GraphicsFeaturePlannerOptions = {},
): GraphicsFeaturePlan {
	const now = (options.now ?? (() => new Date()))()
	const timestamp = now.toISOString()
	const selected = recommendation.candidates.find((candidate) => candidate.level === recommendation.recommendedLevel)
	const design = levelDesign[recommendation.recommendedLevel]
	const risks: GraphicsFeatureRisk[] = [
		{
			id: "R1",
			title: design.risk,
			impact: design.gate ? "high" : "medium",
			mitigation:
				"Validate in an isolated prototype, measure on target hardware, and retain a feature-disable fallback.",
			reviewGate: design.gate,
		},
	]
	if (profile.architectureIndex.truncated) {
		risks.push({
			id: "R2",
			title: "The bounded architecture scan may omit reusable integration points.",
			impact: "medium",
			mitigation: "Review relevant rendering directories before production changes.",
		})
	}

	return {
		version: 1,
		revision: 1,
		source: "generated",
		updatedAt: timestamp,
		title: brief.title,
		briefSummary: provided(brief.visualGoal, `Implement ${brief.title}.`),
		openQuestions: recommendation.assumptions,
		projectContext: [
			`${profile.workspaceName}: ${profile.engine}${profile.engineVersion ? ` ${profile.engineVersion}` : ""}`,
			`Render pipeline: ${profile.renderPipelines.join(", ") || "not detected"}`,
			`${profile.architectureIndex.findings.length} architecture findings from ${profile.architectureIndex.analyzedFileCount} files.`,
		],
		decision: {
			recommendedLevel: recommendation.recommendedLevel,
			rationale: selected?.reasons.length ? selected.reasons : [recommendation.summary],
			alternatives: recommendation.candidates.slice(1, 3).map((candidate) => ({
				level: candidate.level,
				reasonNotSelected:
					candidate.rejectionReasons[0] ?? "The selected option has stronger evidence or lower cost.",
			})),
		},
		pipelineDesign: section(
			design.pipeline,
			`Integrate with ${profile.renderPipelines.join(", ") || "the detected project render path"}.`,
			"Add explicit debug labels, feature toggles, and resource ownership.",
		),
		shaderDesign: section(
			design.shader,
			`Use ${profile.shaderLanguages.join(", ") || "the project shader language"}.`,
			"Document render state, keywords, precision, texture formats, and variant limits.",
		),
		clientDesign: section(
			design.client,
			provided(brief.lifecycle, "Define enable, update, disable, and cleanup behavior."),
			"Keep client APIs independent from transient GPU resource ownership.",
		),
		assetContract: {
			requirements: [
				provided(
					brief.artControls,
					"Define artist-facing controls, ranges, defaults, and source asset requirements.",
				),
				"Provide a known-good template asset and invalid examples.",
			],
			validationRules: [
				"Required properties and references are present.",
				"Texture, mesh, and material settings match documented platform constraints.",
				"Out-of-range values fail with actionable feedback.",
			],
		},
		performanceBudget: section(
			provided(brief.performanceBudget, "Budget must be confirmed before production approval."),
			"Measure GPU time, CPU submission, memory, bandwidth, overdraw, and variant growth.",
			"Record measurements per quality tier and target device.",
		),
		compatibility: buildCompatibility(brief, profile),
		risks,
		tasks: buildTasks(recommendation.recommendedLevel, brief),
		acceptancePlan: buildAcceptance(brief),
		generatedAt: timestamp,
	}
}
