/** Provider-independent interface for structured graphics asset analysis. */

import type {
	GraphicsAssetArtifact,
	GraphicsAssetInventory,
	GraphicsAssetProviderCapabilities,
	GraphicsAssetProviderStatus,
	GraphicsAssetResult,
	GraphicsBuildAssetMemory,
	GraphicsBundleDependencies,
	GraphicsMaterialContract,
	GraphicsMeshAnalysis,
	GraphicsRendererConfiguration,
	GraphicsSerializedComponent,
	GraphicsTextureAnalysis,
} from "./GraphicsAssetTypes"

export interface GraphicsAssetProvider {
	readonly id: string
	readonly displayName: string
	readonly kind: "mcp" | "extension-bridge" | "hybrid"

	getStatus(): Promise<GraphicsAssetProviderStatus>
	isAvailable(): Promise<boolean>
	getCapabilities(): Promise<GraphicsAssetProviderCapabilities>

	loadArtifact(path: string, kind?: string): Promise<GraphicsAssetResult<GraphicsAssetArtifact>>
	getAssetInventory(artifactId?: string): Promise<GraphicsAssetResult<GraphicsAssetInventory>>
	analyzeTexture(assetId: string, artifactId?: string): Promise<GraphicsAssetResult<GraphicsTextureAnalysis>>
	analyzeMesh(assetId: string, artifactId?: string): Promise<GraphicsAssetResult<GraphicsMeshAnalysis>>
	getMaterialContract(assetId: string, artifactId?: string): Promise<GraphicsAssetResult<GraphicsMaterialContract>>
	getRendererConfiguration(assetId: string, artifactId?: string): Promise<GraphicsAssetResult<GraphicsRendererConfiguration>>
	getBuildAssetMemory(artifactId?: string): Promise<GraphicsAssetResult<GraphicsBuildAssetMemory>>
	getBundleDependencies(artifactId?: string): Promise<GraphicsAssetResult<GraphicsBundleDependencies>>
	readSerializedComponent(assetId: string, componentType?: string, artifactId?: string): Promise<GraphicsAssetResult<GraphicsSerializedComponent>>
}
