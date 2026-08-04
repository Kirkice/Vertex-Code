import type {
	GraphicsCaptureArtifact,
	GraphicsCaptureTriggerPolicy,
	GraphicsInvestigationSession,
	GraphicsLaunchProfile,
	GraphicsReproducibilityMetadata,
	GraphicsValidationReport,
} from "../graphics-provider/GraphicsProviderTypes"

export function validateGraphicsLaunchProfile(profile: GraphicsLaunchProfile): string[] {
	const errors: string[] = []
	if (!profile.id.trim()) errors.push("Profile id is required.")
	if (!profile.name.trim()) errors.push("Profile name is required.")
	if (profile.platform === "windows" && !profile.executable?.trim()) errors.push("Windows profiles require an executable.")
	if (profile.platform === "android" && (!profile.packageName?.trim() || !profile.activityName?.trim())) {
		errors.push("Android profiles require packageName and activityName.")
	}
	if (profile.startupWaitMs < 0) errors.push("startupWaitMs must be non-negative.")
	if (profile.performanceBudgetMs !== undefined && profile.performanceBudgetMs <= 0) errors.push("performanceBudgetMs must be positive.")
	if (profile.captureTrigger.mode === "frame" && (profile.captureTrigger.frameNumber === undefined || profile.captureTrigger.frameNumber < 0)) {
		errors.push("Frame capture requires a non-negative frameNumber.")
	}
	if (profile.captureTrigger.mode === "delay" && (profile.captureTrigger.delayMs === undefined || profile.captureTrigger.delayMs < 0)) {
		errors.push("Delayed capture requires a non-negative delayMs.")
	}
	for (const [name, value] of Object.entries(profile.environmentVariables ?? {})) {
		if (!/^[_A-Z][_A-Z0-9]*$/i.test(name)) errors.push(`Invalid environment variable name: ${name}.`)
		if (/(password|secret|token|api[_-]?key)/i.test(name) || /^(?!\$\{)[^$]*$/.test(value)) {
			errors.push(`Environment variable ${name} must use a reference, not a secret value.`)
		}
	}
	return errors
}

export function createInvestigationSession(id: string, now = new Date().toISOString()): GraphicsInvestigationSession {
	return { version: 1, id, status: "idle", evidence: [], createdAt: now, updatedAt: now, revision: 0 }
}

export function createCaptureArtifact(
	providerId: string,
	capturePath: string | undefined,
	metadata: GraphicsReproducibilityMetadata,
	frameSummary: GraphicsCaptureArtifact["frameSummary"],
): GraphicsCaptureArtifact {
	return { id: `${providerId}:${capturePath ?? metadata.capturedAt}`, capturePath, providerId, metadata, frameSummary, createdAt: new Date().toISOString(), cacheRevision: 0 }
}

export function compareCaptureArtifacts(before: GraphicsCaptureArtifact, after: GraphicsCaptureArtifact): GraphicsValidationReport {
	const mismatches: string[] = []
	const left = before.metadata
	const right = after.metadata
	for (const key of ["profileId", "graphicsApi", "gpu", "driver", "qualityLevel", "scene", "camera"] as const) {
		if (left[key] !== undefined && right[key] !== undefined && left[key] !== right[key]) mismatches.push(`${key} differs.`)
	}
	const beforeSummary = before.frameSummary
	const afterSummary = after.frameSummary
	const metrics: GraphicsValidationReport["metrics"] = []
	const addMetric = (name: string, beforeValue: number | undefined, afterValue: number | undefined, budget?: number) => {
		if (beforeValue !== undefined || afterValue !== undefined) {
			const comparable = beforeValue !== undefined && afterValue !== undefined
			metrics.push({
				name,
				before: beforeValue,
				after: afterValue,
				deltaPercent: comparable && beforeValue !== 0 ? ((afterValue - beforeValue) / beforeValue) * 100 : undefined,
				improved: comparable ? afterValue < beforeValue : undefined,
				withinBudget: budget !== undefined && afterValue !== undefined ? afterValue <= budget : undefined,
			})
		}
	}
	addMetric("frameDurationMs", beforeSummary?.totalDurationMs, afterSummary?.totalDurationMs, right.performanceBudgetMs)
	const beforePasses = beforeSummary?.passes ?? []
	const afterPasses = afterSummary?.passes ?? []
	for (const beforePass of beforePasses) {
		const afterPass = afterPasses.find((candidate) => candidate.name === beforePass.name)
		addMetric(`pass:${beforePass.name}`, beforePass.durationMs, afterPass?.durationMs)
	}
	const beforeHot = beforeSummary?.hotEvents ?? []
	const afterHot = afterSummary?.hotEvents ?? []
	for (const beforeEvent of beforeHot) {
		const afterEvent = afterHot.find((candidate) => candidate.eventId === beforeEvent.eventId)
		addMetric(`hotEvent:${beforeEvent.eventId}`, beforeEvent.durationMs, afterEvent?.durationMs)
	}
	const beforeDuration = beforeSummary?.totalDurationMs
	const afterDuration = afterSummary?.totalDurationMs
	const environmentMatches = mismatches.length === 0
	const hasData = beforeDuration !== undefined && afterDuration !== undefined
	const improvedMetrics = metrics.filter((metric) => metric.improved === true).length
	const comparableMetrics = metrics.filter((metric) => metric.improved !== undefined).length
	const status = !environmentMatches ? "incomparable" : !hasData ? "insufficient-data" : afterDuration! < beforeDuration! ? "passed" : "failed"
	return {
		status,
		confidence: !environmentMatches ? "low" : comparableMetrics > 1 ? "high" : hasData ? "medium" : "low",
		summary: !environmentMatches
			? "Captures are not comparable because reproducibility metadata differs."
			: hasData
				? `Frame duration changed from ${beforeDuration}ms to ${afterDuration}ms (${beforeDuration !== 0 ? (((afterDuration! - beforeDuration) / beforeDuration) * 100).toFixed(1) : "n/a"}%); ${improvedMetrics} of ${comparableMetrics} comparable metric(s) improved.`
				: "Frame timing data is insufficient for validation.",
		environmentMatches,
		mismatches,
		metrics,
		evidence: [{ source: "captureComparison", description: "Compared reproducibility metadata, frame duration, pass durations, and hot events.", value: { before, after } }],
		generatedAt: new Date().toISOString(),
	}
}

export type { GraphicsCaptureTriggerPolicy, GraphicsLaunchProfile, GraphicsInvestigationSession, GraphicsValidationReport }
