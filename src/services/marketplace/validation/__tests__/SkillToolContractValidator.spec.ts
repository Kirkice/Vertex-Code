import { describe, expect, it } from "vitest"
import type { MarketplaceReleaseManifest, MarketplaceToolContract } from "@roo-code/types"
import {
	createRenderDocToolContract,
	validateSkillToolContracts,
} from "../SkillToolContractValidator"

const renderdoc = createRenderDocToolContract()
const servers = new Map([
	[
		"renderdoc-for-vscode",
		{
			name: "renderdoc-for-vscode",
			aliases: ["renderdoc", "renderdoc-mcp"],
			tools: renderdoc.tools,
		},
	],
])

const manifest = (requiredTools: MarketplaceToolContract[]): MarketplaceReleaseManifest => ({
	manifestVersion: 1,
	releaseVersion: "1.0.0",
	source: "https://example.com/market",
	branch: "main",
	items: [
		{
			id: "renderdoc-test",
			type: "skill",
			group: "renderdoc",
			version: "1.0.0",
			sourcePath: "skills/renderdoc-test",
			modeSlugs: ["graphics"],
			files: ["SKILL.md", "agents/openai.yaml"],
			requiredCapabilities: ["runtime.capture"],
			requiredTools,
		},
	],
})

describe("SkillToolContractValidator", () => {
	it("accepts raw and dynamic RenderDoc tool names with valid parameters", () => {
		const result = validateSkillToolContracts(
			manifest([
				{ tool: "renderdoc_getEventDetails", server: "renderdoc" , requiredArguments: ["eventId"] },
				{ tool: "mcp__renderdoc-for-vscode__renderdoc_getShaderInfo", requiredArguments: ["eventId"], optionalArguments: ["stage"] },
			]),
			{ mcpServers: servers, platform: "win32-x64" },
		)
		expect(result.valid).toBe(true)
	})

	it("rejects unknown tools and arguments", () => {
		const result = validateSkillToolContracts(
			manifest([{ tool: "renderdoc_missing", requiredArguments: ["captureId"] }]),
			{ mcpServers: servers },
		)
		expect(result.valid).toBe(false)
		expect(result.errors.join("\n")).toContain("is not registered")
	})

	it("rejects unsupported required capabilities", () => {
		const result = validateSkillToolContracts(
			manifest([{ tool: "renderdoc_getCaptureInfo" }]),
			{
				mcpServers: servers,
				capabilities: { getAvailability: () => "unavailable" },
			},
		)
		expect(result.valid).toBe(false)
		expect(result.errors.join("\n")).toContain("runtime.capture")
	})
})
