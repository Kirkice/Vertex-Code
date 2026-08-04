/** Structured build artifact report and Asset Contract validation. */

import type { GraphicsAssetAuditReport } from "./GraphicsAssetAuditor"
import type { GraphicsAssetInventory, GraphicsBuildAssetMemory } from "../GraphicsAssetTypes"

export interface GraphicsAssetContract {
	requiredKinds?: string[]
	maxMemoryBytes?: number
	requiredPaths?: string[]
}

export interface GraphicsBuildArtifactReport {
	artifactId: string
	assetCount: number
	memoryBytes?: number
	byKind: Record<string, number>
	findings: GraphicsAssetAuditReport["findings"]
	contractViolations: string[]
	generatedAt: string
}

export function buildGraphicsArtifactReport(
	inventory: GraphicsAssetInventory,
	audit: GraphicsAssetAuditReport,
	memory?: GraphicsBuildAssetMemory,
	contract: GraphicsAssetContract = {},
): GraphicsBuildArtifactReport {
	const contractViolations: string[] = []
	for (const kind of contract.requiredKinds ?? []) {
		if (!inventory.totals.byKind[kind as keyof typeof inventory.totals.byKind]) contractViolations.push(`Required asset kind is missing: ${kind}`)
	}
	if (contract.maxMemoryBytes !== undefined && (memory?.totalBytes ?? inventory.totals.memoryBytes ?? 0) > contract.maxMemoryBytes) {
		contractViolations.push(`Memory exceeds contract limit: ${contract.maxMemoryBytes} bytes`)
	}
	for (const requiredPath of contract.requiredPaths ?? []) {
		if (!inventory.assets.some((asset) => asset.path === requiredPath)) contractViolations.push(`Required asset path is missing: ${requiredPath}`)
	}
	return {
		artifactId: inventory.artifact.artifactId,
		assetCount: inventory.totals.assetCount,
		memoryBytes: memory?.totalBytes ?? inventory.totals.memoryBytes,
		byKind: { ...inventory.totals.byKind },
		findings: audit.findings,
		contractViolations,
		generatedAt: new Date().toISOString(),
	}
}
