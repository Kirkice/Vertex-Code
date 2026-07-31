import type {
	GraphicsCapabilityRegistryEntry,
	GraphicsCapabilitySourceKind,
} from "@roo-code/types"
import { describe, expect, it } from "vitest"
import { GraphicsCapabilityRegistry } from "../GraphicsCapabilityRegistry"

const createEntry = (
	sourceKind: GraphicsCapabilitySourceKind,
	sourceId: string,
	partial: Partial<GraphicsCapabilityRegistryEntry["descriptor"]> = {},
): GraphicsCapabilityRegistryEntry => ({
	descriptor: {
		id: `${sourceKind}.${sourceId}`,
		label: sourceId,
		sourceKind,
		sourceId,
		providedCapabilities: [],
		availability: "available",
		health: "healthy",
		...partial,
	},
	registeredAt: "2026-07-31T08:00:00.000Z",
})

describe("GraphicsCapabilityRegistry", () => {
	it("normalizes and deterministically lists knowledge, skill, MCP, and provider sources", () => {
		const registry = new GraphicsCapabilityRegistry()
		registry.register(
			createEntry("provider", "renderdoc", {
				providedCapabilities: ["capture.read", "capture.read", "capture.frame"],
			}),
		)
		registry.register(createEntry("knowledge", "unity-rendering"))
		registry.register(createEntry("mcp", "assetstudio"))
		registry.register(createEntry("skill", "graphics-analysis"))

		expect(registry.list().map(({ descriptor }) => `${descriptor.sourceKind}:${descriptor.sourceId}`)).toEqual([
			"knowledge:unity-rendering",
			"mcp:assetstudio",
			"provider:renderdoc",
			"skill:graphics-analysis",
		])
		expect(registry.list()[2].descriptor.providedCapabilities).toEqual([
			"capture.frame",
			"capture.read",
		])
	})

	it("replaces one source without affecting other source kinds", () => {
		const registry = new GraphicsCapabilityRegistry()
		registry.register(createEntry("skill", "shader-analysis", { version: "1.0.0" }))
		registry.register(createEntry("mcp", "assetstudio"))
		registry.register(
			createEntry("skill", "shader-analysis", {
				version: "1.1.0",
				providedCapabilities: ["shader.inspect"],
			}),
		)

		expect(registry.list()).toHaveLength(2)
		expect(registry.findByCapability("shader.inspect")[0].descriptor.version).toBe("1.1.0")
		registry.unregister("mcp", "assetstudio")
		expect(registry.list()).toHaveLength(1)
	})

	it("queries capabilities and aggregates availability across sources", () => {
		const registry = new GraphicsCapabilityRegistry()
		registry.register(
			createEntry("provider", "healthy", {
				providedCapabilities: ["frame.capture"],
			}),
		)
		registry.register(
			createEntry("mcp", "degraded", {
				providedCapabilities: ["frame.capture", "asset.inspect"],
				availability: "degraded",
				health: "degraded",
			}),
		)

		expect(registry.findByCapability("frame.capture")).toHaveLength(2)
		expect(registry.getAvailability("frame.capture")).toBe("available")
		expect(registry.getAvailability("asset.inspect")).toBe("degraded")
		expect(registry.getAvailability("missing")).toBe("unknown")
	})

	it("resolves dependencies only from operational sources", () => {
		const registry = new GraphicsCapabilityRegistry()
		const feature = createEntry("skill", "feature-plan", {
			dependencies: ["project.profile", "shader.inspect", "project.profile"],
		})
		registry.register(feature)
		registry.register(
			createEntry("knowledge", "project-profile", {
				providedCapabilities: ["project.profile"],
			}),
		)
		registry.register(
			createEntry("mcp", "shader-tool", {
				providedCapabilities: ["shader.inspect"],
				availability: "unavailable",
				health: "unavailable",
			}),
		)

		expect(registry.resolveDependencies(feature)).toEqual({
			satisfied: false,
			missing: ["shader.inspect"],
		})

		registry.register(
			createEntry("mcp", "shader-tool", {
				providedCapabilities: ["shader.inspect"],
			}),
		)
		expect(registry.resolveDependencies(feature)).toEqual({ satisfied: true, missing: [] })
	})

	it("returns defensive copies so callers cannot mutate registry state", () => {
		const registry = new GraphicsCapabilityRegistry()
		registry.register(
			createEntry("provider", "renderdoc", {
				providedCapabilities: ["frame.capture"],
			}),
		)

		const listed = registry.list()
		listed[0].descriptor.providedCapabilities.push("unexpected")
		expect(registry.findByCapability("unexpected")).toHaveLength(0)
	})
})
