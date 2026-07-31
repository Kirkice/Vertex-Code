import { describe, expect, it } from "vitest"
import {
	GRAPHICS_QUICK_ACTIONS,
	resolveGraphicsQuickActions,
} from "../GraphicsQuickActions"

describe("resolveGraphicsQuickActions", () => {
	it("keeps provider-independent actions available without runtime capabilities", () => {
		const actions = resolveGraphicsQuickActions(GRAPHICS_QUICK_ACTIONS, {
			getAvailability: () => "unavailable",
		})
		expect(actions.map((action) => action.id)).toEqual([
			"plan-graphics-feature",
			"review-architecture",
			"find-owner",
		])
	})

	it("shows AssetStudio and RenderDoc actions only when their capabilities are available", () => {
		const actions = resolveGraphicsQuickActions(GRAPHICS_QUICK_ACTIONS, {
			getAvailability: (capability) =>
				capability.startsWith("asset.") || capability.startsWith("runtime.")
					? "available"
					: "unavailable",
		})
		expect(actions.map((action) => action.id)).toContain("audit-build-artifact")
		expect(actions.map((action) => action.id)).toContain("analyze-current-frame")
		expect(actions.map((action) => action.id)).toContain("trace-resource")
	})

	it("does not expose degraded or unknown actions as executable", () => {
		const actions = resolveGraphicsQuickActions(
			GRAPHICS_QUICK_ACTIONS.filter((action) => action.id === "analyze-current-frame"),
			{ getAvailability: () => "degraded" },
		)
		expect(actions).toHaveLength(0)
	})
})
