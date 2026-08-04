import { describe, expect, it, vi } from "vitest"
import { RenderDocVsCodeMcpProvider } from "../RenderDocVsCodeMcpProvider"

function createHub(
	servers: Array<{ name: string; disabled?: boolean }>,
	result: unknown = {},
) {
	return {
		getServers: vi.fn(() => servers),
		callTool: vi.fn(async (..._args: unknown[]) => result),
	}
}

describe("RenderDocVsCodeMcpProvider", () => {
	it("reports unavailable when the RenderDoc server is missing", async () => {
		const provider = new RenderDocVsCodeMcpProvider(createHub([]))

		await expect(provider.isAvailable()).resolves.toBe(false)
		await expect(provider.getStatus()).resolves.toMatchObject({
			status: "unavailable",
			providerId: "renderdoc-vscode-mcp",
		})
	})

	it("maps a no-capture health response to no-capture", async () => {
		const hub = createHub([{ name: "renderdoc" }])
		hub.callTool.mockRejectedValue(new Error("No capture is open"))
		const provider = new RenderDocVsCodeMcpProvider(hub)

		await expect(provider.getStatus()).resolves.toMatchObject({
			status: "no-capture",
		})
	})

	it("parses frame, selection, and event responses", async () => {
		const hub = createHub([{ name: "renderdoc-for-vscode" }])
		hub.callTool.mockImplementation(async (...args: unknown[]) => {
			const tool = args[1]
			if (tool === "renderdoc_getFrameSummary") {
				return { content: [{ type: "text", text: JSON.stringify({ durationMs: 8.5, passes: [], topEvents: [{ eventId: 4, name: "Shadow", durationMs: 2.1 }] }) }] }
			}
			if (tool === "renderdoc_getSelectionContext") return { selectedEventId: 4, name: "Shadow", passName: "Main" }
			return { eventId: 4, eventName: "Shadow", durationMs: 2.1, drawCallCount: 3, primitiveCount: 120 }
		})
		const provider = new RenderDocVsCodeMcpProvider(hub)

		await expect(provider.getFrameSummary()).resolves.toMatchObject({
			success: true,
			totalDurationMs: 8.5,
			hotEvents: [{ eventId: 4, name: "Shadow" }],
		})
		await expect(provider.getSelectionContext()).resolves.toMatchObject({
			success: true,
			eventId: 4,
			eventName: "Shadow",
		})
		await expect(provider.getEventDetails(4)).resolves.toMatchObject({
			success: true,
			eventId: 4,
			name: "Shadow",
			drawCallCount: 3,
		})
	})

	it("maps pipeline and shader inspection responses", async () => {
		const hub = createHub([{ name: "renderdoc" }])
		hub.callTool.mockImplementation(async (...args: unknown[]) => {
			const tool = args[1]
			if (tool === "renderdoc_getPipelineState") {
				return {
					eventId: 7,
					renderTargets: [{ slot: 0, name: "Color", format: "rgba8" }],
					vertexBuffers: [{ slot: 1, name: "Vertices" }],
				}
			}
			return {
				eventId: 7,
				stage: "pixel",
				entryPoint: "main",
				language: "HLSL",
				instructionCount: 42,
				inputs: [{ name: "uv", type: "float2" }],
			}
		})
		const provider = new RenderDocVsCodeMcpProvider(hub)

		await expect(provider.getPipelineState(7)).resolves.toMatchObject({
			success: true,
			eventId: 7,
			renderTargets: [{ name: "Color" }],
			vertexBuffers: [{ slot: 1 }],
		})
		await expect(provider.getShaderInfo({ eventId: 7, stage: "pixel" })).resolves.toMatchObject({
			success: true,
			stage: "pixel",
			entryPoint: "main",
			instructionCount: 42,
			inputs: [{ name: "uv" }],
		})
		expect(hub.callTool).toHaveBeenLastCalledWith("renderdoc", "renderdoc_getShaderInfo", { eventId: 7, stage: "pixel" })
	})

	it("returns structured errors when a tool call fails", async () => {
		const hub = createHub([{ name: "renderdoc-mcp" }])
		hub.callTool.mockRejectedValue(new Error("capture tool failed"))
		const provider = new RenderDocVsCodeMcpProvider(hub)

		await expect(provider.getFrameSummary()).resolves.toEqual({
			success: false,
			error: "RenderDoc tool call failed: capture tool failed",
		})
	})
})
