import { createRuleAnalyzer } from "./GraphicsArchitectureAnalyzer"

/**
 * Detects project conventions that are useful before generating a Feature Plan.
 * These rules stay text-based so indexing remains safe for partially imported projects.
 */
export const projectConfigurationAnalyzer = createRuleAnalyzer("project-configuration", [
	{
		category: "asset",
		kind: "graphics-asset-directory",
		pattern: /(?:^|\/)(Shaders?|Materials?|Textures?|VFX|Rendering)(?:\/|$)/i,
		detail: (_match, input) => `Graphics asset is organized under ${input.path.split("/").slice(0, -1).join("/")}.`,
	},
	{
		category: "asset",
		kind: "asset-importer",
		pattern: /(?:TextureImporter|ModelImporter|AudioImporter|ScriptedImporter|m_(?:Importer|TextureSettings)|fileFormatVersion\s*:\s*2)/i,
		detail: () => "Contains Unity importer metadata or importer-specific asset settings.",
	},
	{
		category: "asset",
		kind: "asset-naming-convention",
		pattern: /(?:^|\/)(?:T_|M_|SM_|VFX_|FX_|Shader_|Renderer|Pass|Feature)[A-Z0-9][A-Za-z0-9_-]*(?:\.[A-Za-z0-9]+)+(?:\r?\n|$)/,
		detail: (_match, input) => `Uses a recognizable graphics asset naming convention in ${input.path}.`,
	},
	{
		category: "quality",
		kind: "quality-settings",
		pattern: /(?:^|\/)ProjectSettings\/QualitySettings\.asset(?:\r?\n|$)/i,
		detail: () => "Defines Unity quality levels and per-tier rendering settings.",
	},
	{
		category: "quality",
		kind: "quality-tier",
		pattern: /(?:m_QualitySettings|m_CurrentQuality|m_PerPlatformDefaultQuality|qualityLevel|pixelLightCount|shadowDistance|shadowResolution|antiAliasing|renderingPath)\s*:/i,
		detail: (match) => `Defines a concrete quality-tier parameter: ${match[1]}.`,
	},
	{
		category: "quality",
		kind: "graphics-settings",
		pattern: /(?:^|\/)ProjectSettings\/GraphicsSettings\.asset(?:\r?\n|$)/i,
		detail: () => "Defines Unity graphics and render-pipeline configuration.",
	},
])
