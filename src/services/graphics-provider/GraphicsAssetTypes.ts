/** Structured contracts for graphics asset providers and AssetStudio results. */

export type GraphicsAssetProviderAvailability = "available" | "degraded" | "unavailable"
export type GraphicsAssetProviderHealth = "healthy" | "degraded" | "unavailable"
export type GraphicsAssetKind =
	| "texture"
	| "mesh"
	| "material"
	| "renderer"
	| "shader"
	| "animation"
	| "component"
	| "bundle"
	| "unknown"

export interface GraphicsAssetProviderStatus {
	providerId: string
	providerName: string
	availability: GraphicsAssetProviderAvailability
	health: GraphicsAssetProviderHealth
	serverName?: string
	message?: string
	diagnostics: string[]
	checkedAt: string
}

export interface GraphicsAssetProviderCapabilities {
	loadArtifact: boolean
	assetInventory: boolean
	texture: boolean
	mesh: boolean
	material: boolean
	renderer: boolean
	memory: boolean
	dependencies: boolean
	serializedComponent: boolean
	audit: boolean
}

export interface GraphicsAssetArtifact {
	artifactId: string
	path: string
	kind?: "unity-project" | "asset-bundle" | "apk" | "addressables" | "unknown"
	loadedAt: string
	metadata?: Record<string, unknown>
}

export interface GraphicsAssetInventoryItem {
	id: string
	name?: string
	path?: string
	kind: GraphicsAssetKind
	guid?: string
	bundle?: string
	address?: string
	dependencies?: string[]
	memoryBytes?: number
	metadata?: Record<string, unknown>
}

export interface GraphicsAssetInventory {
	artifact: GraphicsAssetArtifact
	assets: GraphicsAssetInventoryItem[]
	totals: {
	assetCount: number
	memoryBytes?: number
	byKind: Partial<Record<GraphicsAssetKind, number>>
	bundleCount?: number
	dependencyCount?: number
	}
	generatedAt: string
}

export interface GraphicsTextureAnalysis {
	assetId: string
	name?: string
	width?: number
	height?: number
	depth?: number
	format?: string
	mipCount?: number
	compressed?: boolean
	readable?: boolean
	memoryBytes?: number
	metadata?: Record<string, unknown>
}

export interface GraphicsMeshAnalysis {
	assetId: string
	name?: string
	vertexCount?: number
	indexCount?: number
	subMeshCount?: number
	readable?: boolean
	memoryBytes?: number
	bounds?: Record<string, unknown>
	metadata?: Record<string, unknown>
}

export interface GraphicsMaterialContract {
	assetId: string
	name?: string
	shader?: string
	properties?: string[]
	textures?: string[]
	keywords?: string[]
	metadata?: Record<string, unknown>
}

export interface GraphicsRendererConfiguration {
	assetId: string
	name?: string
	meshId?: string
	materialIds?: string[]
	enabled?: boolean
	layer?: number
	shadowCasting?: string
	receiveShadows?: boolean
	metadata?: Record<string, unknown>
}

export interface GraphicsBuildAssetMemory {
	artifactId: string
	totalBytes?: number
	byKind: Partial<Record<GraphicsAssetKind, number>>
	byBundle: Record<string, number>
	largestAssets: Array<{ assetId: string; name?: string; bytes: number }>
	metadata?: Record<string, unknown>
}

export interface GraphicsBundleDependencies {
	artifactId: string
	bundles: Array<{ id: string; name?: string; dependencies: string[]; sizeBytes?: number }>
	cycles?: string[][]
}

export interface GraphicsSerializedComponent {
	assetId: string
	type?: string
	fields: Record<string, unknown>
}

export interface GraphicsAssetResult<T> {
	success: boolean
	data?: T
	error?: string
	diagnostics?: string[]
}

export interface GraphicsAssetProviderHealthOptions {
	/** Optional local executable/package checks supplied by the host. */
	executablePath?: string
	requiredFiles?: string[]
	/** When true, a missing local package is a degraded connection rather than hard failure. */
	allowRemoteMcp?: boolean
}

export interface GraphicsAssetProviderOptions extends GraphicsAssetProviderHealthOptions {
	serverNames?: readonly string[]
	toolNames?: Partial<GraphicsAssetToolNames>
	healthProbeTool?: string
}

export interface GraphicsAssetToolNames {
	loadArtifact: string
	getAssetInventory: string
	analyzeTexture: string
	analyzeMesh: string
	getMaterialContract: string
	getRendererConfiguration: string
	getBuildAssetMemory: string
	getBundleDependencies: string
	readSerializedComponent: string
}
