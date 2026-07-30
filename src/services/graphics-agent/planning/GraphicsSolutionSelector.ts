import type {
	GraphicsFeatureBrief,
	GraphicsProjectProfile,
	GraphicsSolutionCandidate,
	GraphicsSolutionLevel,
	GraphicsSolutionRecommendation,
} from "@roo-code/types"

interface GraphicsSolutionSelectorOptions {
	now?: () => Date
}

interface CandidateDefinition {
	level: GraphicsSolutionLevel
	label: string
	baseScore: number
	complexity: number
}

interface ScoringRule {
	levels: readonly GraphicsSolutionLevel[]
	pattern: RegExp
	score: number
	reason: string
	risk?: string
}

const candidateDefinitions: readonly CandidateDefinition[] = [
	{ level: "configuration", label: "Existing parameters or asset configuration", baseScore: 16, complexity: 1 },
	{ level: "shader", label: "Material or shader implementation", baseScore: 14, complexity: 2 },
	{ level: "renderer-pass", label: "Renderer Feature or custom render pass", baseScore: 10, complexity: 4 },
	{ level: "post-process", label: "Post-processing pipeline extension", baseScore: 9, complexity: 4 },
	{ level: "render-graph", label: "Render Graph or render-pipeline modification", baseScore: 3, complexity: 7 },
	{ level: "compute", label: "Compute shader or asynchronous GPU work", baseScore: 4, complexity: 6 },
	{ level: "cpu-client", label: "CPU or client-side implementation", baseScore: 6, complexity: 3 },
]

const bilingualPattern = (english: string, chinese: string): RegExp =>
	new RegExp(`(?:\\b(?:${english})\\b|(?:${chinese}))`, "i")

const scoringRules: readonly ScoringRule[] = [
	{
		levels: ["configuration"],
		pattern: bilingualPattern("parameter|material|texture|asset|prefab|configuration", "配置|参数|材质|贴图|资源"),
		score: 12,
		reason: "The brief can potentially reuse existing material, asset, or configuration controls.",
	},
	{
		levels: ["shader"],
		pattern: bilingualPattern(
			"surface|material|shader|vertex|fragment|fresnel|dissolve|outline",
			"表面|材质|着色器|溶解|描边",
		),
		score: 18,
		reason: "The requested visual behavior is primarily local to a surface or material.",
	},
	{
		levels: ["renderer-pass", "post-process"],
		pattern: bilingualPattern(
			"screen|fullscreen|camera|depth|normal|mask|outline",
			"屏幕|全屏|相机|深度|法线|遮罩|描边",
		),
		score: 15,
		reason: "The effect appears to require camera-wide data or a dedicated rendering stage.",
		risk: "Validate injection order, camera stacking, render-target lifetime, and bandwidth.",
	},
	{
		levels: ["post-process"],
		pattern: bilingualPattern(
			"post[- ]?process|bloom|tone.?map|color grading|vignette",
			"后处理|泛光|色调映射|调色",
		),
		score: 20,
		reason: "The brief explicitly describes a screen-space post-processing effect.",
	},
	{
		levels: ["render-graph"],
		pattern: bilingualPattern(
			"gbuffer|lighting model|render graph|pipeline|history buffer|motion vector",
			"光照模型|渲染管线|历史帧|运动矢量",
		),
		score: 22,
		reason: "The requirement may need new cross-pass resources or a rendering-pipeline change.",
		risk: "This level has the largest regression and multi-platform validation surface.",
	},
	{
		levels: ["compute"],
		pattern: bilingualPattern(
			"compute|simulation|particles?|indirect|gpu generated",
			"并行|模拟|粒子|间接绘制|GPU生成",
		),
		score: 20,
		reason: "The workload suggests large-scale parallel processing or GPU-generated data.",
		risk: "Validate synchronization, barriers, memory traffic, and target-platform compute support.",
	},
	{
		levels: ["cpu-client"],
		pattern: bilingualPattern(
			"gameplay|state|event|timeline|network|lifecycle|trigger",
			"玩法|状态|事件|时间轴|网络|生命周期|触发",
		),
		score: 13,
		reason: "The feature requires meaningful gameplay, event, or lifecycle orchestration.",
	},
]

const highRiskLevels = new Set<GraphicsSolutionLevel>(["render-graph", "compute"])

function createCandidates(): Map<GraphicsSolutionLevel, GraphicsSolutionCandidate & { complexity: number }> {
	return new Map(
		candidateDefinitions.map((definition) => [
			definition.level,
			{
				level: definition.level,
				label: definition.label,
				score: definition.baseScore,
				complexity: definition.complexity,
				confidence: "low",
				reasons: [],
				risks: [],
				rejectionReasons: [],
			},
		]),
	)
}

function collectBriefText(brief: GraphicsFeatureBrief): string {
	return [
		brief.title,
		brief.visualGoal,
		brief.lifecycle,
		brief.artControls,
		brief.targetPlatforms,
		brief.performanceBudget,
		brief.compatibilityRequirements,
		brief.acceptanceCriteria,
	].join("\n")
}

function addProjectEvidence(
	candidates: Map<GraphicsSolutionLevel, GraphicsSolutionCandidate & { complexity: number }>,
	profile: GraphicsProjectProfile,
): void {
	const projectText = [
		...profile.renderPipelines,
		...profile.architectureSignals,
		...profile.architectureIndex.findings.map((finding) => `${finding.kind} ${finding.detail}`),
	].join("\n")

	const evidenceRules: readonly [GraphicsSolutionLevel, RegExp, string][] = [
		["shader", /shader|lightmode|keyword|include/i, "The project already contains reusable shader entry points."],
		[
			"renderer-pass",
			/renderer feature|render pass|custom pass|scriptablerender/i,
			"The project already exposes a custom pass or renderer-feature extension point.",
		],
		[
			"post-process",
			/post.?process|volume/i,
			"The project already contains a post-processing or volume extension point.",
		],
		[
			"render-graph",
			/render graph|rendergraph/i,
			"The project already uses Render Graph, reducing integration uncertainty.",
		],
	]

	for (const [level, pattern, reason] of evidenceRules) {
		if (pattern.test(projectText)) {
			const candidate = candidates.get(level)
			if (candidate) {
				candidate.score += 8
				candidate.reasons.push(reason)
			}
		}
	}
}

function finalizeCandidates(
	candidates: Map<GraphicsSolutionLevel, GraphicsSolutionCandidate & { complexity: number }>,
): GraphicsSolutionCandidate[] {
	const ranked = [...candidates.values()].sort(
		(left, right) => right.score - left.score || left.complexity - right.complexity,
	)
	const leadingScore = ranked[0]?.score ?? 0

	return ranked.map(({ complexity: _complexity, ...candidate }, index) => {
		const scoreGap = leadingScore - candidate.score
		candidate.confidence = index === 0 && candidate.reasons.length >= 2 ? "high" : scoreGap <= 8 ? "medium" : "low"
		if (index > 0) {
			candidate.rejectionReasons.push(
				scoreGap > 12
					? "The brief and project evidence provide substantially less support for this level."
					: "A lower-cost or better-supported candidate currently ranks higher.",
			)
		}
		if (highRiskLevels.has(candidate.level) && candidate.reasons.length === 0) {
			candidate.rejectionReasons.push(
				"No explicit requirement currently justifies this high-impact implementation level.",
			)
		}
		return candidate
	})
}

export function selectGraphicsSolution(
	brief: GraphicsFeatureBrief,
	profile: GraphicsProjectProfile,
	options: GraphicsSolutionSelectorOptions = {},
): GraphicsSolutionRecommendation {
	const candidates = createCandidates()
	const briefText = collectBriefText(brief)

	for (const rule of scoringRules) {
		if (!rule.pattern.test(briefText)) continue
		for (const level of rule.levels) {
			const candidate = candidates.get(level)
			if (!candidate) continue
			candidate.score += rule.score
			candidate.reasons.push(rule.reason)
			if (rule.risk) candidate.risks.push(rule.risk)
		}
	}

	addProjectEvidence(candidates, profile)
	const rankedCandidates = finalizeCandidates(candidates)
	const recommended = rankedCandidates[0]
	const assumptions: string[] = []

	if (!brief.performanceBudget.trim()) assumptions.push("No explicit performance budget was provided.")
	if (!brief.targetPlatforms.trim()) assumptions.push("No target platform or graphics API was provided.")
	if (profile.engine === "unknown")
		assumptions.push("The project engine is unknown, so integration confidence is limited.")
	if (profile.architectureIndex.truncated)
		assumptions.push("The architecture index was truncated and may omit reusable entry points.")

	return {
		version: 1,
		recommendedLevel: recommended.level,
		summary: `${recommended.label} is the current lowest-risk fit based on the Feature Brief and ${profile.workspaceName} architecture evidence.`,
		candidates: rankedCandidates,
		assumptions,
		generatedAt: (options.now ?? (() => new Date()))().toISOString(),
	}
}
