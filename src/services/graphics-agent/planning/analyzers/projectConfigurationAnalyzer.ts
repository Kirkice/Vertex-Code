import { createRuleAnalyzer } from "./GraphicsArchitectureAnalyzer"

export const projectConfigurationAnalyzer = createRuleAnalyzer("project-configuration", [
	{
		category: "asset",
		kind: "graphics-asset-directory",
		pattern: /(?:^|\/)(Shaders?|Materials?|Textures?|VFX|Rendering)(?:\/|$)/i,
		detail: (_match, input) => `Graphics asset is organized under ${input.path.split("/").slice(0, -1).join("/")}.`,
	},
	{
		category: "quality",
		kind: "quality-settings",
		pattern: /(?:^|\/)ProjectSettings\/QualitySettings\.asset(?:\r?\n|$)/i,
		detail: () => "Defines Unity quality levels and per-tier rendering settings.",
	},
	{
		category: "quality",
		kind: "graphics-settings",
		pattern: /(?:^|\/)ProjectSettings\/GraphicsSettings\.asset(?:\r?\n|$)/i,
		detail: () => "Defines Unity graphics and render-pipeline configuration.",
	},
])
