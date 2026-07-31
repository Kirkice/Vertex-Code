import { readFile } from "node:fs/promises"
import * as path from "node:path"

import * as yaml from "yaml"
import { describe, expect, it } from "vitest"

import type { MarketplaceItem } from "@roo-code/types"
import { validateMarketplaceReleaseManifest } from "../MarketplaceManifestValidator"

type CatalogFile = { path: string }

type CatalogItem = MarketplaceItem & { files?: CatalogFile[]; sourcePath?: string; source?: string }

async function loadFixture(): Promise<{ manifest: any; catalog: CatalogItem[] }> {
	const root = path.resolve(__dirname, "../../../../assets/marketplace")
	const release = yaml.parse(await readFile(path.join(root, "graphics-release.yml"), "utf8"))
	const skills = yaml.parse(await readFile(path.join(root, "skills.yml"), "utf8")).items
	const mcps = yaml.parse(await readFile(path.join(root, "mcps.yml"), "utf8")).items
	const ids = new Set(release.items.map((item: { id: string }) => item.id))
	return {
		manifest: release,
		catalog: [...skills, ...mcps]
			.filter((item) => ids.has(item.id))
			.map((item) => ({ type: item.id === "asset-studio-mcp" ? "mcp" : "skill", ...item })),
	}
}

describe("validateMarketplaceReleaseManifest", () => {
	it("accepts the checked-in Graphics release inventory and complete AssetStudio allowlist", async () => {
		const { manifest, catalog } = await loadFixture()
		const result = validateMarketplaceReleaseManifest(manifest, { catalogItems: catalog })

		expect(result.valid).toBe(true)
		expect(result.errors).toEqual([])
		expect(manifest.items).toHaveLength(14)
		expect(manifest.items.find((item: { id: string }) => item.id === "asset-studio-mcp").files).toHaveLength(62)
	})

	it("rejects duplicate IDs, unknown catalog entries, and unsafe paths", async () => {
		const { manifest, catalog } = await loadFixture()
		const invalid = structuredClone(manifest)
		invalid.items[1].id = invalid.items[0].id
		invalid.items[0].files.push("../outside.dll")
		invalid.items.push({ ...invalid.items[0], id: "unknown-skill", sourcePath: "skills/unknown" })

		const result = validateMarketplaceReleaseManifest(invalid, { catalogItems: catalog })

		expect(result.valid).toBe(false)
		expect(result.errors.some((error) => error.includes("duplicate release item id"))).toBe(true)
		expect(result.errors.some((error) => error.includes("unsafe package path"))).toBe(true)
		expect(result.errors.some((error) => error.includes("not present in the marketplace catalog"))).toBe(true)
	})

	it("rejects incomplete Skill and MCP packages", async () => {
		const { manifest, catalog } = await loadFixture()
		const invalid = structuredClone(manifest)
		const skill = invalid.items.find((item: { id: string }) => item.id === "renderdoc-frame-overview")
		skill.files = ["SKILL.md"]
		const mcp = invalid.items.find((item: { id: string }) => item.id === "asset-studio-mcp")
		mcp.executable = "missing.exe"
		mcp.healthCheck.requiredFiles = ["missing.runtimeconfig.json"]

		const result = validateMarketplaceReleaseManifest(invalid, { catalogItems: catalog })

		expect(result.valid).toBe(false)
		expect(result.errors.some((error) => error.includes("agents/openai.yaml"))).toBe(true)
		expect(result.errors.some((error) => error.includes("not in the release allowlist"))).toBe(true)
	})

	it("checks fetched package parity when package files are supplied", async () => {
		const { manifest, catalog } = await loadFixture()
		const asset = manifest.items.find((item: { id: string }) => item.id === "asset-studio-mcp")
		const packageFiles = new Map<string, ReadonlySet<string>>([
			["asset-studio-mcp", new Set(asset.files.slice(0, -1))],
		])

		const result = validateMarketplaceReleaseManifest(manifest, { catalogItems: catalog, packageFiles })

		expect(result.valid).toBe(false)
		expect(result.errors.some((error) => error.includes("missing from the fetched package"))).toBe(true)
	})
})
