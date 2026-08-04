/** Deterministic source/build identity mapping for Unity asset results. */

import { createHash } from "node:crypto"
import type { GraphicsAssetInventoryItem } from "../GraphicsAssetTypes"

export interface GraphicsAssetIdentityInput {
	asset: GraphicsAssetInventoryItem
	sourcePath?: string
	sourceGuid?: string
	sourceHash?: string
	artifactHash?: string
}

export interface GraphicsAssetIdentity {
	assetId: string
	artifactId: string
	sourcePath?: string
	sourceGuid?: string
	sourceHash?: string
	artifactHash?: string
	confidence: "exact" | "strong" | "weak" | "unresolved"
	evidence: string[]
	diagnostics: string[]
}

export class GraphicsAssetIdentityMapper {
	map(input: GraphicsAssetIdentityInput): GraphicsAssetIdentity {
		const { asset } = input
		const evidence: string[] = []
		const diagnostics: string[] = []
		if (input.sourceGuid && asset.guid && input.sourceGuid === asset.guid) evidence.push("unity-meta-guid")
		if (input.sourcePath && asset.path && normalize(input.sourcePath) === normalize(asset.path)) evidence.push("source-path")
		if (input.sourceHash && input.artifactHash && input.sourceHash === input.artifactHash) evidence.push("content-hash")
		if (asset.bundle) evidence.push("asset-bundle")
		const confidence = evidence.includes("unity-meta-guid")
			? "exact"
			: evidence.includes("source-path") || evidence.includes("content-hash")
				? "strong"
				: evidence.length
					? "weak"
					: "unresolved"
		if (confidence === "unresolved") diagnostics.push("No matching Unity GUID, source path, or content hash was provided.")
		return {
			assetId: asset.id,
			artifactId: asset.bundle ?? asset.id,
			sourcePath: input.sourcePath,
			sourceGuid: input.sourceGuid,
			sourceHash: input.sourceHash,
			artifactHash: input.artifactHash,
			confidence,
			evidence,
			diagnostics,
		}
	}

	static fingerprint(value: string): string {
		return createHash("sha256").update(value).digest("hex")
	}
}

function normalize(value: string): string {
	return value.replaceAll("\\", "/").replace(/^\.\//, "").toLowerCase()
}
