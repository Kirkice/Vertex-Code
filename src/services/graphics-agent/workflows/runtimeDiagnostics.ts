import type { GraphicsCaptureProvider } from "../../graphics-provider/GraphicsCaptureProvider"
import type {
	EvidenceItem,
	GraphicsProviderCapabilities,
	GraphicsWorkflowRequest,
	GraphicsWorkflowResult,
	PipelineStateResult,
	ShaderInfoResult,
	SuspectedIssue,
} from "../../graphics-provider/GraphicsProviderTypes"
import type { GraphicsWorkflow } from "../GraphicsWorkflowOrchestrator"
import { GraphicsRuntimeCache } from "../GraphicsRuntimeCache"

interface CacheObservation {
	key: string
	hit: boolean
	stale: boolean
}

const readCached = <T>(cache: GraphicsRuntimeCache | undefined, key: string): { value?: T; observation: CacheObservation } => {
	const entry = cache?.get<T>(key)
	return {
		value: entry && !entry.stale ? entry.value : undefined,
		observation: { key, hit: Boolean(entry && !entry.stale), stale: Boolean(entry?.stale) },
	}
}

const cacheEvidence = (observations: CacheObservation[]): EvidenceItem => ({
	source: "graphicsRuntimeCache",
	description: observations.map((observation) => `${observation.hit ? "hit" : "miss"}${observation.stale ? " (stale)" : ""}`).join(", "),
	value: observations,
})

const success = (
	summary: string,
	evidence: EvidenceItem[],
	suspectedIssues: SuspectedIssue[],
	suggestions: string[],
	rawData: Record<string, unknown>,
): GraphicsWorkflowResult => ({ success: true, summary, evidence, suspectedIssues, suggestions, rawData })

const failure = (summary: string, error: string, evidence: EvidenceItem[] = []): GraphicsWorkflowResult => ({
	success: false,
	summary,
	evidence,
	suspectedIssues: [],
	suggestions: ["Check that a capture is open and the selected provider supports this diagnostic."],
	error,
})

export class FramePerformanceWorkflow implements GraphicsWorkflow {
	readonly intent = "frame_performance" as const
	readonly requiredCapabilities: Partial<GraphicsProviderCapabilities> = { frameSummary: true, passGraph: true }

	constructor(private readonly cache?: GraphicsRuntimeCache) {}

	async execute(provider: GraphicsCaptureProvider, request: GraphicsWorkflowRequest): Promise<GraphicsWorkflowResult> {
		const key = GraphicsRuntimeCache.createKey({ providerId: provider.id, captureIdentity: request.graphicsSessionId ?? "current", profileId: request.graphicsProfileId, sessionId: request.graphicsSessionId })
		const cached = readCached<Awaited<ReturnType<GraphicsCaptureProvider["getFrameSummary"]>>>(this.cache, key)
		const frame = cached.value ?? await provider.getFrameSummary()
		if (!cached.value && frame.success) this.cache?.set(key, frame)
		if (!frame.success) return failure("Frame performance unavailable", frame.error ?? "Frame summary failed")
		const evidence: EvidenceItem[] = [
			{ source: "frameSummary", description: `Frame time: ${frame.totalDurationMs?.toFixed(2) ?? "unknown"} ms`, value: frame },
			cacheEvidence([cached.observation]),
		]
		const issues: SuspectedIssue[] = []
		const suggestions = ["Inspect the hottest event and its owning pass before optimizing."]
		if ((frame.totalDurationMs ?? 0) > 33.33) {
			issues.push({ category: "performance", description: "Frame time exceeds the 30 FPS budget.", confidence: "high" })
			suggestions.push("Prioritize the most expensive pass and hot event.")
		} else if ((frame.totalDurationMs ?? 0) > 16.67) {
			issues.push({ category: "performance", description: "Frame time exceeds the 60 FPS budget.", confidence: "medium" })
		}
		return success(
			`Frame performance: ${frame.totalDurationMs?.toFixed(2) ?? "unknown"} ms across ${frame.passes?.length ?? 0} passes.`,
			evidence,
			issues,
			suggestions,
			{ frame },
		)
	}
}

export class ShaderAnalysisWorkflow implements GraphicsWorkflow {
	readonly intent = "shader_analysis" as const
	readonly requiredCapabilities: Partial<GraphicsProviderCapabilities> = { shaderInfo: true }

	constructor(private readonly cache?: GraphicsRuntimeCache) {}

	async execute(provider: GraphicsCaptureProvider, request: GraphicsWorkflowRequest): Promise<GraphicsWorkflowResult> {
		if (request.eventId === undefined) return failure("Shader analysis needs an event ID", "eventId is required")
		const base = { providerId: provider.id, captureIdentity: request.graphicsSessionId ?? "current", eventId: request.eventId, profileId: request.graphicsProfileId, sessionId: request.graphicsSessionId, sourceRevision: request.shaderStage ?? "pixel" }
		const shaderKey = GraphicsRuntimeCache.createKey(base)
		const shaderCached = readCached<ShaderInfoResult>(this.cache, shaderKey)
		const shader: ShaderInfoResult = shaderCached.value ?? await provider.getShaderInfo({ eventId: request.eventId, stage: request.shaderStage ?? "pixel" })
		if (!shaderCached.value && shader.success) this.cache?.set(shaderKey, shader)
		if (!shader.success) return failure("Shader analysis unavailable", shader.error ?? "Shader info failed", [cacheEvidence([shaderCached.observation])])
		const sourceKey = GraphicsRuntimeCache.createKey({ ...base, sourceRevision: `${shader.stage ?? request.shaderStage ?? "pixel"}:${shader.shaderId ?? "unknown"}` })
		const sourceCached = readCached<Awaited<ReturnType<GraphicsCaptureProvider["getShaderSource"]>>>(this.cache, sourceKey)
		const source = sourceCached.value ?? await provider.getShaderSource({ eventId: request.eventId, stage: shader.stage, shaderId: shader.shaderId })
		if (!sourceCached.value && source.success) this.cache?.set(sourceKey, source)
		const issues: SuspectedIssue[] = []
		if ((shader.instructionCount ?? 0) > 500) {
			issues.push({ category: "performance", description: `Shader has ${shader.instructionCount} instructions.`, confidence: "medium" })
		}
		return success(
			`${shader.stage ?? request.shaderStage ?? "Shader"} shader ${shader.entryPoint ?? "unknown"} uses ${shader.instructionCount ?? "unknown"} instructions${shader.shaderId ? ` (${shader.shaderId})` : ""}.`,
			[
				{ source: "shaderInfo", description: "Shader reflection and complexity retrieved.", value: shader },
				...(source.success ? [{ source: "shaderSource", description: `Shader source retrieved${source.filePath ? ` from ${source.filePath}` : ""}.`, value: source }] : []),
				cacheEvidence([shaderCached.observation, sourceCached.observation]),
			],
			issues,
			["Compare shader complexity with the event timing and affected render targets."],
			{ shader, shaderSource: source },
		)
	}
}

export class PipelineAnalysisWorkflow implements GraphicsWorkflow {
	readonly intent = "pipeline_analysis" as const
	readonly requiredCapabilities: Partial<GraphicsProviderCapabilities> = { pipelineState: true, eventDetails: true }

	constructor(private readonly cache?: GraphicsRuntimeCache) {}

	async execute(provider: GraphicsCaptureProvider, request: GraphicsWorkflowRequest): Promise<GraphicsWorkflowResult> {
		if (request.eventId === undefined) return failure("Pipeline analysis needs an event ID", "eventId is required")
		const base = { providerId: provider.id, captureIdentity: request.graphicsSessionId ?? "current", eventId: request.eventId, profileId: request.graphicsProfileId, sessionId: request.graphicsSessionId }
		const pipelineCached = readCached<Awaited<ReturnType<GraphicsCaptureProvider["getPipelineState"]>>>(this.cache, GraphicsRuntimeCache.createKey({ ...base, sourceRevision: "pipeline" }))
		const eventCached = readCached<Awaited<ReturnType<GraphicsCaptureProvider["getEventDetails"]>>>(this.cache, GraphicsRuntimeCache.createKey({ ...base, sourceRevision: "event" }))
		const [pipeline, event] = await Promise.all([
			pipelineCached.value ?? provider.getPipelineState(request.eventId),
			eventCached.value ?? provider.getEventDetails(request.eventId),
		])
		if (!pipelineCached.value && pipeline.success) this.cache?.set(GraphicsRuntimeCache.createKey({ ...base, sourceRevision: "pipeline" }), pipeline)
		if (!eventCached.value && event.success) this.cache?.set(GraphicsRuntimeCache.createKey({ ...base, sourceRevision: "event" }), event)
		if (!pipeline.success) return failure("Pipeline analysis unavailable", pipeline.error ?? "Pipeline state failed")
		const issues: SuspectedIssue[] = []
		if (!pipeline.depthStencil) issues.push({ category: "configuration", description: "No depth/stencil resource is bound.", confidence: "low" })
		return success(
			`Pipeline analysis for EID ${request.eventId}: ${pipeline.renderTargets?.length ?? 0} render targets, ${pipeline.vertexBuffers?.length ?? 0} vertex buffers${event.success && event.durationMs !== undefined ? `, ${event.durationMs.toFixed(2)} ms` : ""}.`,
			[
				{ source: "pipelineState", description: "Pipeline bindings retrieved.", value: pipeline },
				...(event.success ? [{ source: "eventDetails", description: "Event timing retrieved.", value: event }] : []),
				cacheEvidence([pipelineCached.observation, eventCached.observation]),
			],
			issues,
			["Review resource formats, bindings, and event timing together."],
			{ pipeline, event },
		)
	}
}

export class ResourceTraceWorkflow implements GraphicsWorkflow {
	readonly intent = "resource_trace" as const
	readonly requiredCapabilities: Partial<GraphicsProviderCapabilities> = { pipelineState: true }

	constructor(private readonly cache?: GraphicsRuntimeCache) {}

	async execute(provider: GraphicsCaptureProvider, request: GraphicsWorkflowRequest): Promise<GraphicsWorkflowResult> {
		if (request.eventId === undefined) return failure("Resource trace needs an event ID", "eventId is required")
		const base = { providerId: provider.id, captureIdentity: request.graphicsSessionId ?? "current", eventId: request.eventId, profileId: request.graphicsProfileId, sessionId: request.graphicsSessionId }
		const pipelineKey = GraphicsRuntimeCache.createKey({ ...base, sourceRevision: "pipeline" })
		const pipelineCached = readCached<PipelineStateResult>(this.cache, pipelineKey)
		const pipeline: PipelineStateResult = pipelineCached.value ?? await provider.getPipelineState(request.eventId)
		if (!pipelineCached.value && pipeline.success) this.cache?.set(pipelineKey, pipeline)
		if (!pipeline.success) return failure("Resource trace unavailable", pipeline.error ?? "Pipeline state failed")
		const bindings = [
			...(pipeline.renderTargets ?? []),
			...(pipeline.vertexBuffers ?? []),
			...(pipeline.samplers ?? []),
			...(pipeline.constantBuffers ?? []),
			...(pipeline.depthStencil ? [pipeline.depthStencil] : []),
		]
		const filtered = request.resourceId ? bindings.filter((binding) => binding.name === request.resourceId || String(binding.slot) === request.resourceId) : bindings
		const historyKey = request.resourceId ? GraphicsRuntimeCache.createKey({ ...base, sourceRevision: `resource-history:${request.resourceId}` }) : undefined
		const historyCached = historyKey ? readCached<Awaited<ReturnType<GraphicsCaptureProvider["getResourceHistory"]>>>(this.cache, historyKey) : undefined
		const history = request.resourceId ? (historyCached?.value ?? await provider.getResourceHistory({ resourceId: request.resourceId, eventId: request.eventId })) : undefined
		if (historyKey && history && !historyCached?.value && history.success) this.cache?.set(historyKey, history)
		return success(
			`Resource trace for EID ${request.eventId}: ${filtered.length} matching binding(s)${history?.success ? ` and ${history.history?.length ?? 0} lifecycle event(s)` : ""}.`,
			[
				{ source: "pipelineState", description: "Resource bindings retrieved from pipeline state.", value: filtered },
				...(history?.success ? [{ source: "resourceHistory", description: "Resource lifecycle history retrieved.", value: history }] : []),
				cacheEvidence([pipelineCached.observation, ...(historyCached ? [historyCached.observation] : [])]),
			],
			filtered.length === 0 ? [{ category: "resource", description: "No matching resource binding was found.", confidence: "medium" }] : [],
			["Map the resource name to project code when a project mapping provider is available."],
			{ pipeline, resourceId: request.resourceId, resourceHistory: history },
		)
	}
}

export class CaptureCompareWorkflow implements GraphicsWorkflow {
	readonly intent = "regression_compare" as const
	readonly requiredCapabilities: Partial<GraphicsProviderCapabilities> = { pipelineState: true }

	async execute(provider: GraphicsCaptureProvider, request: GraphicsWorkflowRequest): Promise<GraphicsWorkflowResult> {
		if (request.eventIdA === undefined || request.eventIdB === undefined) return failure("Capture comparison needs two event IDs", "eventIdA and eventIdB are required")
		const diff = await provider.diffPipelineState({ eventIdA: request.eventIdA, eventIdB: request.eventIdB })
		const [a, b] = diff.success ? [undefined, undefined] : await Promise.all([provider.getPipelineState(request.eventIdA), provider.getPipelineState(request.eventIdB)])
		if (diff.success) {
			const differences = diff.differences ?? []
			return success(
				differences.length ? `Events ${request.eventIdA} and ${request.eventIdB} differ in ${differences.length} pipeline field(s).` : `Events ${request.eventIdA} and ${request.eventIdB} have matching pipeline state.`,
				[{ source: "pipelineDiff", description: "Compared pipeline fields using the provider diff operation.", value: diff }],
				differences.length ? [{ category: "correctness", description: "Pipeline fields differ between comparison events.", confidence: "high" }] : [],
				["Inspect the changed pipeline fields and map shader or resource identifiers to project code."],
				{ eventIdA: request.eventIdA, eventIdB: request.eventIdB, pipelineDiff: diff },
			)
		}
		if (!a?.success || !b?.success) return failure("Capture comparison unavailable", a?.error ?? b?.error ?? diff.error ?? "Pipeline state comparison failed")
		const differences = [
			a.renderTargets?.length !== b.renderTargets?.length ? "render target count" : undefined,
			a.vertexBuffers?.length !== b.vertexBuffers?.length ? "vertex buffer count" : undefined,
			a.samplers?.length !== b.samplers?.length ? "sampler count" : undefined,
		].filter(Boolean) as string[]
		return success(
			differences.length ? `Events ${request.eventIdA} and ${request.eventIdB} differ in ${differences.join(", ")}.` : `Events ${request.eventIdA} and ${request.eventIdB} have matching binding counts.`,
			[{ source: "pipelineCompare", description: "Compared pipeline binding counts.", value: { a, b, differences } }],
			differences.length ? [{ category: "correctness", description: "Pipeline binding counts differ between comparison events.", confidence: "medium" }] : [],
			["Inspect the differing events in the capture tool for a semantic state comparison."],
			{ eventIdA: request.eventIdA, eventIdB: request.eventIdB, a, b, differences },
		)
	}
}
