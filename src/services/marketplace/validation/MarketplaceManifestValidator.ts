import * as path from "node:path"

import {
	marketplaceReleaseManifestSchema,
	type MarketplaceItem,
	type MarketplaceReleaseManifest,
	type MarketplaceReleaseItem,
} from "@roo-code/types"

export interface MarketplaceManifestValidationContext {
	catalogItems: MarketplaceItem[]
	/** Files actually present in the package, relative to the item's sourcePath. */
	packageFiles?: ReadonlyMap<string, ReadonlySet<string>>
}

export interface MarketplaceManifestValidationResult {
	valid: boolean
	manifest?: MarketplaceReleaseManifest
	errors: string[]
	warnings: string[]
}

/**
 * Validates the explicit release inventory against the marketplace catalogs.
 * This is deliberately independent of network access; CI can provide a
 * packageFiles map after fetching the remote tree, while local tests can use
 * catalog metadata only.
 */
export function validateMarketplaceReleaseManifest(
	value: unknown,
	context: MarketplaceManifestValidationContext,
): MarketplaceManifestValidationResult {
	const errors: string[] = []
	const warnings: string[] = []
	const parsed = marketplaceReleaseManifestSchema.safeParse(value)

	if (!parsed.success) {
		return {
			valid: false,
			errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`),
			warnings,
		}
	}

	const manifest = parsed.data
	const seenIds = new Set<string>()
	const catalogByKey = new Map(context.catalogItems.map((item) => [`${item.type}:${item.id}`, item]))

	for (const item of manifest.items) {
		validateReleaseItem(item, context, catalogByKey, seenIds, errors, warnings)
	}

	return { valid: errors.length === 0, manifest, errors, warnings }
}

function validateReleaseItem(
	item: MarketplaceReleaseItem,
	context: MarketplaceManifestValidationContext,
	catalogByKey: ReadonlyMap<string, MarketplaceItem>,
	seenIds: Set<string>,
	errors: string[],
	warnings: string[],
): void {
	const label = `${item.type}:${item.id}`
	if (seenIds.has(item.id)) {
		errors.push(`${label}: duplicate release item id '${item.id}'`)
	}
	seenIds.add(item.id)

	const catalogItem = catalogByKey.get(label)
	if (!catalogItem) {
		errors.push(`${label}: item is not present in the marketplace catalog`)
		return
	}

	const catalogSource = "source" in catalogItem ? catalogItem.source : undefined
	const catalogSourcePath = "sourcePath" in catalogItem ? catalogItem.sourcePath : undefined
	if (!catalogSource) {
		errors.push(`${label}: catalog item has no source URL`)
	}
	if (!catalogSourcePath || catalogSourcePath !== item.sourcePath) {
		errors.push(`${label}: sourcePath does not match the marketplace catalog`)
	}

	const catalogFiles = new Set(
		("files" in catalogItem ? catalogItem.files ?? [] : []).map((file) => file.path),
	)
	const releaseFiles = new Set(item.files)
	for (const file of item.files) {
		if (!isSafeRelativePath(file)) {
			errors.push(`${label}: unsafe package path '${file}'`)
		}
		if (!catalogFiles.has(file)) {
			errors.push(`${label}: file '${file}' is not present in the marketplace catalog allowlist`)
		}
	}
	for (const file of catalogFiles) {
		if (!releaseFiles.has(file)) {
			warnings.push(`${label}: catalog file '${file}' is not included in the release allowlist`)
		}
	}

	if (item.type === "skill") {
		if (!releaseFiles.has("SKILL.md")) {
			errors.push(`${label}: skill release must include SKILL.md`)
		}
		if (item.id.startsWith("renderdoc-") && !releaseFiles.has("agents/openai.yaml")) {
			errors.push(`${label}: RenderDoc skill release must include agents/openai.yaml`)
		}
	}

	if (item.type === "mcp") {
		validateMcpItem(item, releaseFiles, errors, label)
	}

	const packageFiles = context.packageFiles?.get(item.id)
	if (packageFiles) {
		for (const file of item.files) {
			if (!packageFiles.has(file)) {
				errors.push(`${label}: release file '${file}' is missing from the fetched package`)
			}
		}
	}
}

function validateMcpItem(
	item: MarketplaceReleaseItem,
	releaseFiles: ReadonlySet<string>,
	errors: string[],
	label: string,
): void {
	if (!item.executable) {
		errors.push(`${label}: MCP release must declare an executable`)
	} else {
		if (!isSafeRelativePath(item.executable)) {
			errors.push(`${label}: executable escapes the package root`)
		}
		if (!releaseFiles.has(item.executable)) {
			errors.push(`${label}: executable '${item.executable}' is not in the release allowlist`)
		}
	}

	if (!item.healthCheck) {
		errors.push(`${label}: MCP release must declare a runtime health check`)
	} else {
		if (item.healthCheck.executable !== item.executable) {
			errors.push(`${label}: health-check executable must match the MCP executable`)
		}
		for (const file of item.healthCheck.requiredFiles) {
			if (!isSafeRelativePath(file) || !releaseFiles.has(file)) {
				errors.push(`${label}: health-check file '${file}' is not in the release allowlist`)
			}
		}
	}

	if (!item.platforms?.length) {
		errors.push(`${label}: MCP release must declare supported platforms`)
	}
	if (!item.prerequisites?.length) {
		errors.push(`${label}: MCP release must declare runtime prerequisites`)
	}

	const hasRuntimeDescriptor = [...releaseFiles].some((file) => file.endsWith(".runtimeconfig.json"))
	const hasDependencyDescriptor = [...releaseFiles].some((file) => file.endsWith(".deps.json"))
	if (!hasRuntimeDescriptor || !hasDependencyDescriptor) {
		errors.push(`${label}: MCP release must include runtimeconfig.json and deps.json descriptors`)
	}
}

function isSafeRelativePath(value: string): boolean {
	if (!value || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
		return false
	}
	const normalized = path.posix.normalize(value.replaceAll("\\", "/"))
	return normalized !== "." && normalized !== ".." && !normalized.startsWith("../") && !normalized.includes("/../")
}
