import { describe, expect, it, vi } from "vitest"
import { AssetStudioMcpProvider, parseAssetStudioToolResult } from "../AssetStudioMcpProvider"

function createHub(servers: Array<{ name: string; disabled?: boolean }>, result: unknown = {}) {
	return {
		getServers: vi.fn(() => servers),
		callTool: vi.fn(async () => result),
	}
}

describe("AssetStudioMcpProvider", () => {
	it("parses structured MCP text content", () => {
		expect(parseAssetStudioToolResult({ content: [{ type: "text", text: '{"assetCount":2}' }] })).toEqual({ assetCount: 2 })
	})

	it("reports unavailable when no AssetStudio server is connected", async () => {
		const provider = new AssetStudioMcpProvider(createHub([]))
		await expect(provider.isAvailable()).resolves.toBe(false)
		await expect(provider.getStatus()).resolves.toMatchObject({
			availability: "unavailable",
			health: "unavailable",
		})
	})

	it("discovers aliases, probes health, and loads an artifact", async () => {
		const hub = createHub([{ name: "asset-studio" }], {
			content: [{ type: "text", text: JSON.stringify({ artifactId: "artifact-1", path: "Build/game" }) }],
		})
		const provider = new AssetStudioMcpProvider(hub)
		await expect(provider.getStatus()).resolves.toMatchObject({
			availability: "available",
			health: "healthy",
			serverName: "asset-studio",
		})
		await expect(provider.loadArtifact("Build/game", "asset-bundle")).resolves.toMatchObject({
			success: true,
			data: { artifactId: "artifact-1" },
		})
		expect(hub.callTool).toHaveBeenCalledWith("asset-studio", "assetStudio_loadArtifact", {
			path: "Build/game",
			kind: "asset-bundle",
		})
	})

	it("returns structured operation errors", async () => {
		const hub = createHub([{ name: "asset-studio-mcp" }])
		hub.callTool.mockRejectedValue(new Error("tool unavailable"))
		const provider = new AssetStudioMcpProvider(hub)
		await expect(provider.getAssetInventory()).resolves.toEqual({ success: false, error: "tool unavailable" })
	})
})
