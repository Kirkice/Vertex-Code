import type { GraphicsCaptureProvider } from "../../graphics-provider/GraphicsCaptureProvider"
import { GraphicsOperationController, GraphicsOperationStageError, type GraphicsOperationProgress, type GraphicsOperationStage } from "../GraphicsOperationController"
import type { GraphicsWorkflow } from "../GraphicsWorkflowOrchestrator"
import type { GraphicsProviderCapabilities, GraphicsWorkflowRequest, GraphicsWorkflowResult } from "../../graphics-provider/GraphicsProviderTypes"
import { createCaptureArtifact, createInvestigationSession, validateGraphicsLaunchProfile, type GraphicsLaunchProfile } from "../GraphicsLaunchSession"
import type { GraphicsLaunchProfileStore } from "../persistence/GraphicsLaunchProfileStore"

async function withWorkflowTimeout<T>(operation: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
	if (signal?.aborted) throw new Error("CANCELLED")
	let timer: ReturnType<typeof setTimeout> | undefined
	let abort: (() => void) | undefined
	const cancellation = signal
		? new Promise<never>((_, reject) => {
				abort = () => reject(new Error("CANCELLED"))
				 signal.addEventListener("abort", abort, { once: true })
			})
		: undefined
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs)
	})
	try {
		return await Promise.race([operation, timeout, ...(cancellation ? [cancellation] : [])])
	} finally {
		if (timer) clearTimeout(timer)
		if (signal && abort) signal.removeEventListener("abort", abort)
	}
}

function stageTimeouts(totalMs: number): Partial<Record<GraphicsOperationStage, number>> {
	return {
		launch: Math.max(1_000, Math.min(30_000, Math.round(totalMs * 0.2))),
		"live-target": Math.max(1_000, Math.min(60_000, Math.round(totalMs * 0.3))),
		"capture-trigger": Math.max(1_000, Math.min(15_000, Math.round(totalMs * 0.1))),
		"capture-completion": Math.max(1_000, Math.min(90_000, Math.round(totalMs * 0.4))),
	}
}

export class LaunchAndCaptureWorkflow implements GraphicsWorkflow {
	readonly intent = "launch_and_capture" as GraphicsWorkflowRequest["intent"]
	readonly requiredCapabilities: Partial<GraphicsProviderCapabilities> = {
		launchTarget: true,
		liveTarget: true,
		captureTrigger: true,
		capturePolling: true,
		frameSummary: true,
	}

	constructor(
		private readonly profile?: GraphicsLaunchProfile,
		private readonly store?: GraphicsLaunchProfileStore,
	) {}

	async execute(provider: GraphicsCaptureProvider, request: GraphicsWorkflowRequest): Promise<GraphicsWorkflowResult> {
		const profile = this.profile ?? (request.graphicsProfileId && this.store ? await this.store.getProfile(request.graphicsProfileId) : undefined)
		if (!profile) return this.failure("PROFILE_INVALID", request.graphicsProfileId ? `Launch Profile ${request.graphicsProfileId} was not found.` : "A Launch Profile is required.")
		const profileErrors = validateGraphicsLaunchProfile(profile)
		if (profileErrors.length) return this.failure("PROFILE_INVALID", profileErrors.join(" "))
		const sessionId = request.graphicsSessionId ?? request.requestId ?? `${profile.id}:${Date.now()}`
		const session = this.store ? await this.store.loadSession(sessionId) ?? createInvestigationSession(sessionId) : createInvestigationSession(sessionId)
		session.status = "running"
		session.profileId = profile.id
		session.revision += 1
		if (this.store) await this.store.saveSession(session)
		if (!provider.launchTarget || !provider.waitForLiveTarget || !provider.triggerCapture || !provider.waitForCapture) {
			return this.failure("PROVIDER_UNAVAILABLE", "The selected provider does not support launch and capture.")
		}
		const totalTimeoutMs = request.timeoutMs ?? 120_000
		const context = {
			requestId: request.requestId,
			sessionId: sessionId,
			timeoutMs: totalTimeoutMs,
			signal: request.signal,
		}
		if (context.signal?.aborted) {
			session.status = "cancelled"
			session.revision += 1
			if (this.store) await this.store.saveSession(session)
			return this.failure("CANCELLED", "Launch and capture was cancelled.")
		}
		let lifecycle: Awaited<ReturnType<GraphicsOperationController["run"]>>
		const progress: GraphicsOperationProgress[] = []
		try {
			lifecycle = await new GraphicsOperationController(provider, {
				timeouts: stageTimeouts(totalTimeoutMs),
				onProgress: (update) => {
					progress.push(update)
				},
			}).run(profile, context)
		} catch (error) {
			session.evidence = progress.map((update) => ({
				source: "operationProgress",
				description: `Graphics operation reached ${update.stage}.`,
				value: update,
			}))
			session.status = error instanceof Error && error.message === "CANCELLED" ? "cancelled" : "failed"
			session.revision += 1
			if (this.store) await this.store.saveSession(session)
			const stage = error instanceof GraphicsOperationStageError ? error.stage : undefined
			const code = error instanceof Error && error.message === "CANCELLED"
				? "CANCELLED"
				: error instanceof Error && error.message === "TIMEOUT"
					? stage === "launch" ? "TARGET_LAUNCH_FAILED"
						: stage === "live-target" ? "LIVE_TARGET_TIMEOUT"
							: stage === "capture-trigger" ? "CAPTURE_TRIGGER_FAILED"
								: "CAPTURE_TIMEOUT"
					: stage === "launch" ? "TARGET_LAUNCH_FAILED" : "PROVIDER_UNAVAILABLE"
			return this.failure(code, error instanceof Error ? error.message : String(error))
		}
		const { launched, live, triggered, completed } = lifecycle
		session.evidence = progress.map((update) => ({
			source: "operationProgress",
			description: `Graphics operation reached ${update.stage}.`,
			value: update,
		}))
		if (!launched.success || !launched.targetId) return this.persistFailure(session, "TARGET_LAUNCH_FAILED", launched.error ?? "Target launch failed.")
		if (!live.success || !live.ready) return this.persistFailure(session, "LIVE_TARGET_TIMEOUT", live.error ?? "Live target was not ready.")
		if (!triggered.success || !triggered.operationId) return this.persistFailure(session, "CAPTURE_TRIGGER_FAILED", triggered.error ?? "Capture trigger failed.")
		if (!completed.success || !completed.completed) return this.persistFailure(session, "CAPTURE_TIMEOUT", completed.error ?? "Capture did not complete.")
		if (request.signal?.aborted) return this.persistFailure(session, "CANCELLED", "Launch and capture was cancelled.")
		let opened
		try {
			opened = await withWorkflowTimeout(provider.openCurrentCapture(), Math.max(1_000, Math.min(30_000, Math.round(totalTimeoutMs * 0.1))), request.signal)
		} catch (error) {
			return this.persistFailure(session, error instanceof Error && error.message === "CANCELLED" ? "CANCELLED" : "CAPTURE_LOAD_FAILED", error instanceof Error ? error.message : String(error))
		}
		if (!opened.success) return this.persistFailure(session, "CAPTURE_LOAD_FAILED", opened.error ?? "Capture could not be opened.")
		let summary
		try {
			summary = await withWorkflowTimeout(provider.getFrameSummary(), Math.max(1_000, Math.min(30_000, Math.round(totalTimeoutMs * 0.1))), request.signal)
		} catch (error) {
			return this.persistFailure(session, error instanceof Error && error.message === "CANCELLED" ? "CANCELLED" : "FRAME_SUMMARY_FAILED", error instanceof Error ? error.message : String(error))
		}
		if (!summary.success) return this.persistFailure(session, "FRAME_SUMMARY_FAILED", summary.error ?? "Frame summary failed.")
		const metadata = { profileId: profile.id, graphicsApi: opened.api, captureTrigger: profile.captureTrigger, capturedAt: new Date().toISOString() }
		const artifact = createCaptureArtifact(provider.id, completed.capturePath ?? opened.capturePath, metadata, summary)
		session.status = "completed"
		session.revision += 1
		session.updatedAt = new Date().toISOString()
		session.baselineCapture = artifact
		session.environment = metadata
		if (this.store) await this.store.saveSession(session)
		return { success: true, intent: this.intent, providerId: provider.id, summary: "Launch and capture completed.", evidence: [{ source: "captureArtifact", description: "Capture was launched, opened, and summarized.", value: artifact }, { source: "investigationSession", description: "Capture was bound to an investigation session.", value: session }], suspectedIssues: [], suggestions: [], rawData: { artifact, session } }
	}

	private async persistFailure(
		session: ReturnType<typeof createInvestigationSession>,
		code: string,
		message: string,
	): Promise<GraphicsWorkflowResult> {
		session.status = code === "CANCELLED" ? "cancelled" : "failed"
		session.revision += 1
		session.updatedAt = new Date().toISOString()
		if (this.store) await this.store.saveSession(session)
		return this.failure(code, message)
	}

	private failure(code: string, message: string): GraphicsWorkflowResult {
		return { success: false, intent: this.intent, summary: message, evidence: [], suspectedIssues: [], suggestions: [code === "PROVIDER_UNAVAILABLE" ? "Select a provider with launch and capture capabilities." : "Retry the operation after correcting the reported condition."], error: `${code}: ${message}` }
	}
}
