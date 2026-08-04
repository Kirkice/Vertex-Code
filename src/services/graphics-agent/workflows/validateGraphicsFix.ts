import type { GraphicsCaptureProvider } from "../../graphics-provider/GraphicsCaptureProvider"
import type { GraphicsWorkflow } from "../GraphicsWorkflowOrchestrator"
import type { GraphicsProviderCapabilities, GraphicsWorkflowRequest, GraphicsWorkflowResult, GraphicsCaptureArtifact, GraphicsInvestigationSession } from "../../graphics-provider/GraphicsProviderTypes"
import { compareCaptureArtifacts, createInvestigationSession } from "../GraphicsLaunchSession"
import { LaunchAndCaptureWorkflow } from "./launchAndCapture"
import type { GraphicsLaunchProfile } from "../GraphicsLaunchSession"
import type { GraphicsLaunchProfileStore } from "../persistence/GraphicsLaunchProfileStore"

export class ValidateGraphicsFixWorkflow implements GraphicsWorkflow {
	readonly intent = "recapture_validation" as GraphicsWorkflowRequest["intent"]
	readonly requiredCapabilities: Partial<GraphicsProviderCapabilities> = { frameSummary: true }

	constructor(
		private readonly baseline?: GraphicsCaptureArtifact,
		private readonly candidate?: GraphicsCaptureArtifact,
		private readonly profile?: GraphicsLaunchProfile,
		private readonly store?: GraphicsLaunchProfileStore,
	) {}

	async execute(provider: GraphicsCaptureProvider, request: GraphicsWorkflowRequest): Promise<GraphicsWorkflowResult> {
		if (request.signal?.aborted) return this.failure("CANCELLED", "Validation was cancelled.")
		const sessionId = request.graphicsSessionId ?? request.requestId ?? (this.baseline ? `${this.baseline.id}:validation` : undefined)
		const persistedSession = sessionId && this.store ? await this.store.loadSession(sessionId) : undefined
		const baseline = this.baseline ?? persistedSession?.baselineCapture
		if (!baseline) return this.failure("INSUFFICIENT_DATA", "A baseline capture is required.")

		let candidate = this.candidate ?? persistedSession?.candidateCapture
		if (!candidate && this.profile) {
			const recaptureRequest = { ...request, graphicsSessionId: sessionId }
			const recapture = await new LaunchAndCaptureWorkflow(this.profile, this.store).execute(provider, recaptureRequest)
			if (!recapture.success) return recapture
			candidate = recapture.rawData?.artifact as GraphicsCaptureArtifact | undefined
		}
		if (!candidate) return this.failure("INSUFFICIENT_DATA", "A candidate capture is required.")

		const report = compareCaptureArtifacts(baseline, candidate)
		const session = persistedSession ?? createInvestigationSession(sessionId ?? `${baseline.id}:validation`)
		session.status = report.status === "passed" ? "completed" : report.status === "incomparable" ? "failed" : "failed"
		session.profileId = this.profile?.id ?? session.profileId ?? baseline.metadata.profileId
		session.baselineCapture = baseline
		session.candidateCapture = candidate
		session.validation = report
		session.evidence = [...session.evidence, ...report.evidence]
		session.revision += 1
		session.updatedAt = new Date().toISOString()
		if (this.store) await this.store.saveSession(session)
		return {
			success: report.status === "passed",
			intent: this.intent,
			providerId: provider.id,
			summary: report.summary,
			evidence: [
				...report.evidence,
				{ source: "validationReport", description: "Baseline and candidate captures were compared.", value: report },
				{ source: "investigationSession", description: "Validation was persisted to the investigation session.", value: session },
			],
			suspectedIssues: report.status === "failed" ? [{ category: "performance", description: "Candidate frame duration did not improve or validation did not pass.", confidence: report.confidence }] : [],
			suggestions: report.status === "incomparable" ? ["Re-capture using the same profile, scene, camera, API, GPU, and driver."] : report.status === "insufficient-data" ? ["Collect frame timing and diagnostic evidence for both captures."] : [],
			rawData: { report, baseline, candidate, sessionId: session.id, session },
		}
	}

	private failure(code: string, message: string): GraphicsWorkflowResult {
		return { success: false, intent: this.intent, summary: message, evidence: [], suspectedIssues: [], suggestions: [code === "CANCELLED" ? "The operation can be retried when ready." : "Run Launch and Capture for both baseline and candidate captures."], error: `${code}: ${message}` }
	}
}
