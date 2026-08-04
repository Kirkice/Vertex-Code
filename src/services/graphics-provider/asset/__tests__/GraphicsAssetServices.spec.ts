import { describe, expect, it } from "vitest"
import type { GraphicsAssetInventory } from "../../GraphicsAssetTypes"
import { GraphicsAssetIdentityMapper } from "../GraphicsAssetIdentityMapper"
import { GraphicsAssetAuditor } from "../GraphicsAssetAuditor"
import { buildGraphicsArtifactReport } from "../GraphicsAssetReport"

const inventory: GraphicsAssetInventory = {
	artifact: { artifactId: "build-1", path: "game.bundle", loadedAt: "2026-01-01T00:00:00.000Z" },
	assets: [
		{ id: "a", name: "Albedo", kind: "texture", guid: "guid-1", path: "Assets/a.png", memoryBytes: 100 },
		{ id: "b", name: "AlbedoCopy", kind: "texture", guid: "guid-1", path: "Assets/b.png", memoryBytes: 100 },
	],
	totals: { assetCount: 2, memoryBytes: 200, byKind: { texture: 2 } },
	generatedAt: "2026-01-01T00:00:00.000Z",
}

describe("graphics asset services", () => {
	it("maps exact Unity GUID identity and fingerprints values", () => {
		const mapper = new GraphicsAssetIdentityMapper()
		expect(mapper.map({ asset: inventory.assets[0], sourceGuid: "guid-1", sourcePath: "Assets/a.png" })).toMatchObject({ confidence: "exact", evidence: ["unity-meta-guid", "source-path"] })
		expect(GraphicsAssetIdentityMapper.fingerprint("asset")).toHaveLength(64)
	})

	it("audits duplicates and projects an Asset Contract report", () => {
		const audit = new GraphicsAssetAuditor({ maxTotalMemoryBytes: 150 }).audit(inventory, { artifactId: "build-1", totalBytes: 200, byKind: { texture: 200 }, byBundle: {}, largestAssets: [] })
		expect(audit.duplicateGroups).toHaveLength(1)
		const report = buildGraphicsArtifactReport(inventory, audit, undefined, { requiredKinds: ["mesh"], maxMemoryBytes: 150 })
		expect(report.contractViolations).toEqual(["Required asset kind is missing: mesh", "Memory exceeds contract limit: 150 bytes"])
	})
})
