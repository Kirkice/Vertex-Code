/** Provider-independent audits for inventory and build memory results. */

import type {
	GraphicsAssetInventory,
	GraphicsBuildAssetMemory,
	GraphicsTextureAnalysis,
	GraphicsMeshAnalysis,
} from "../GraphicsAssetTypes"

export interface GraphicsAssetAuditFinding {
	code: string
	severity: "info" | "warning" | "error"
	assetIds: string[]
	message: string
}

export interface GraphicsAssetAuditReport {
	artifactId: string
	findings: GraphicsAssetAuditFinding[]
	duplicateGroups: Array<{ key: string; assetIds: string[] }>
	generatedAt: string
}

export interface GraphicsAssetAuditOptions {
	maxTextureDimension?: number
	maxMeshMemoryBytes?: number
	maxTotalMemoryBytes?: number
}

export class GraphicsAssetAuditor {
	constructor(private readonly options: GraphicsAssetAuditOptions = {}) {}

	audit(
		inventory: GraphicsAssetInventory,
		memory?: GraphicsBuildAssetMemory,
		textureAnalyses: GraphicsTextureAnalysis[] = [],
		meshAnalyses: GraphicsMeshAnalysis[] = [],
	): GraphicsAssetAuditReport {
		const findings: GraphicsAssetAuditFinding[] = []
		const duplicateGroups = collectDuplicates(inventory)
		for (const group of duplicateGroups) {
			findings.push({ code: "duplicate-asset", severity: "warning", assetIds: group.assetIds, message: `Duplicate asset identity: ${group.key}` })
		}
		for (const texture of textureAnalyses) {
			if (this.options.maxTextureDimension && Math.max(texture.width ?? 0, texture.height ?? 0) > this.options.maxTextureDimension) {
				findings.push({ code: "texture-dimension", severity: "warning", assetIds: [texture.assetId], message: `Texture exceeds ${this.options.maxTextureDimension}px.` })
			}
		}
		for (const mesh of meshAnalyses) {
			if (this.options.maxMeshMemoryBytes && (mesh.memoryBytes ?? 0) > this.options.maxMeshMemoryBytes) {
				findings.push({ code: "mesh-memory", severity: "warning", assetIds: [mesh.assetId], message: `Mesh exceeds the configured memory budget.` })
			}
		}
		if (this.options.maxTotalMemoryBytes && (memory?.totalBytes ?? inventory.totals.memoryBytes ?? 0) > this.options.maxTotalMemoryBytes) {
			findings.push({ code: "total-memory", severity: "error", assetIds: [], message: "Build asset memory exceeds the configured budget." })
		}
		return { artifactId: inventory.artifact.artifactId, findings, duplicateGroups, generatedAt: new Date().toISOString() }
	}
}

function collectDuplicates(inventory: GraphicsAssetInventory): Array<{ key: string; assetIds: string[] }> {
	const groups = new Map<string, string[]>()
	for (const asset of inventory.assets) {
		const key = asset.guid ?? `${asset.kind}:${asset.path ?? asset.name ?? asset.id}`
		groups.set(key, [...(groups.get(key) ?? []), asset.id])
	}
	return [...groups.entries()].filter(([, assetIds]) => assetIds.length > 1).map(([key, assetIds]) => ({ key, assetIds }))
}
