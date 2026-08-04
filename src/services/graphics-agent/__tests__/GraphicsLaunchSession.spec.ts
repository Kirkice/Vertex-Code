import { describe, expect, it } from "vitest"
import {
	compareCaptureArtifacts,
	createCaptureArtifact,
	validateGraphicsLaunchProfile,
} from "../GraphicsLaunchSession"

const profile = {
	version: 1 as const,
	id: "demo",
	name: "Demo",
	platform: "windows" as const,
	executable: "demo.exe",
	captureTrigger: { mode: "immediate" as const },
	startupWaitMs: 1000,
	updatedAt: "2026-01-01T00:00:00.000Z",
}

const artifact = (duration: number, profileId = "demo") =>
	createCaptureArtifact(
		"test-provider",
		`capture-${duration}.rdc`,
		{
			profileId,
			graphicsApi: "d3d12",
			performanceBudgetMs: 16.67,
			capturedAt: "2026-01-01T00:00:00.000Z",
		},
		{
			success: true,
			totalDurationMs: duration,
			passes: [{ name: "opaque", eventIdRange: [1, 2], durationMs: duration }],
			hotEvents: [{ eventId: 1, name: "draw", durationMs: duration }],
		},
	)

describe("GraphicsLaunchSession", () => {
	it("validates platform and secret profile constraints", () => {
		expect(validateGraphicsLaunchProfile(profile)).toEqual([])
		expect(
			validateGraphicsLaunchProfile({
				...profile,
				environmentVariables: { API_KEY: "plain-text" },
			}),
		).toContain("Environment variable API_KEY must use a reference, not a secret value.")
	})

	it("compares frame, pass, hot-event, percentage, and budget metrics", () => {
		const report = compareCaptureArtifacts(artifact(20), artifact(15))
		expect(report.status).toBe("passed")
		expect(report.metrics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "frameDurationMs", deltaPercent: -25, withinBudget: true }),
				expect.objectContaining({ name: "pass:opaque", improved: true }),
				expect.objectContaining({ name: "hotEvent:1", improved: true }),
			]),
		)
	})

	it("rejects comparisons with incompatible reproducibility metadata", () => {
		const report = compareCaptureArtifacts(artifact(20), artifact(15, "other"))
		expect(report.status).toBe("incomparable")
		expect(report.environmentMatches).toBe(false)
	})
})
