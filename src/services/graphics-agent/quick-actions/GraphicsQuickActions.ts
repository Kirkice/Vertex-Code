import type { GraphicsCapabilityAvailability } from "@roo-code/types"

export interface GraphicsQuickAction {
	id: string
	label: string
	description: string
	requiredCapabilities: readonly string[]
	alwaysAvailable?: boolean
	action: {
		type: string
		[key: string]: unknown
	}
}

export interface GraphicsQuickActionContext {
	getAvailability(capability: string): GraphicsCapabilityAvailability
}

export interface ResolvedGraphicsQuickAction extends GraphicsQuickAction {
	availability: GraphicsCapabilityAvailability
	reason?: string
}

export const GRAPHICS_QUICK_ACTIONS: readonly GraphicsQuickAction[] = [
	{
		id: "plan-graphics-feature",
		label: "Plan Graphics Feature",
		description: "Create a structured graphics feature plan.",
		requiredCapabilities: [],
		alwaysAvailable: true,
		action: { type: "runGraphicsWorkflow", intent: "feature-plan" },
	},
	{
		id: "review-architecture",
		label: "Review Architecture Decision",
		description: "Review project rendering architecture and trade-offs.",
		requiredCapabilities: [],
		alwaysAvailable: true,
		action: { type: "runGraphicsWorkflow", intent: "architecture-review" },
	},
	{
		id: "validate-assets",
		label: "Validate Asset Contract",
		description: "Validate graphics asset requirements and constraints.",
		requiredCapabilities: ["asset.inventory"],
		action: { type: "runGraphicsWorkflow", intent: "asset-validation" },
	},
	{
		id: "audit-build-artifact",
		label: "Audit Build Artifact",
		description: "Inspect a build artifact with AssetStudio.",
		requiredCapabilities: ["asset.inventory", "asset.texture", "asset.mesh", "asset.material"],
		action: { type: "runGraphicsWorkflow", intent: "asset-audit" },
	},
	{
		id: "analyze-current-frame",
		label: "Analyze Current Frame",
		description: "Summarize the active RenderDoc capture.",
		requiredCapabilities: ["runtime.capture"],
		action: { type: "analyzeCurrentFrame" },
	},
	{
		id: "explain-selected-draw",
		label: "Explain Selected Draw",
		description: "Explain the selected RenderDoc draw or event.",
		requiredCapabilities: ["runtime.capture", "runtime.selection"],
		action: { type: "explainSelectedDraw" },
	},
	{
		id: "analyze-shader",
		label: "Analyze Shader",
		description: "Inspect the selected captured shader.",
		requiredCapabilities: ["runtime.capture", "runtime.shader"],
		action: { type: "runGraphicsPlaybook", playbookId: "shader-analysis" },
	},
	{
		id: "trace-resource",
		label: "Trace Selected Resource",
		description: "Trace producers and consumers of a captured resource.",
		requiredCapabilities: ["runtime.capture", "runtime.resource"],
		action: { type: "runGraphicsPlaybook", playbookId: "resource-trace" },
	},
	{
		id: "compare-captures",
		label: "Compare Captures",
		description: "Compare two RenderDoc captures.",
		requiredCapabilities: ["runtime.capture", "runtime.replay"],
		action: { type: "runGraphicsPlaybook", playbookId: "regression-compare" },
	},
	{
		id: "find-owner",
		label: "Find Owner In Project",
		description: "Map a graphics issue back to project ownership.",
		requiredCapabilities: [],
		alwaysAvailable: true,
		action: { type: "findOwnerInProject" },
	},
]

export function resolveGraphicsQuickActions(
	actions: readonly GraphicsQuickAction[],
	context: GraphicsQuickActionContext,
): ResolvedGraphicsQuickAction[] {
	return actions
		.map((action): ResolvedGraphicsQuickAction => {
			if (action.alwaysAvailable || action.requiredCapabilities.length === 0) {
				return { ...action, availability: "available" as const }
			}
			const states = action.requiredCapabilities.map((capability) => context.getAvailability(capability))
			const availability: GraphicsCapabilityAvailability = states.includes("available")
				? "available"
				: states.includes("degraded")
					? "degraded"
					: states.includes("unknown")
						? "unknown"
						: "unavailable"
			return {
				...action,
				availability,
				reason: availability === "available" ? undefined : `Requires: ${action.requiredCapabilities.join(", ")}`,
			}
		})
		.filter((action) => action.availability === "available")
}
