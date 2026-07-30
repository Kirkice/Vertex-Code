import { createRuleAnalyzer } from "./GraphicsArchitectureAnalyzer"

export const pipelineAnalyzer = createRuleAnalyzer("pipeline", [
	{
		category: "pipeline",
		kind: "render-pipeline-asset",
		pattern: /m_(?:RenderPipelineAsset|CustomRenderPipeline):\s*\{[^}]*guid:\s*([a-f\d]{32})/i,
		detail: (match) => `References render pipeline asset GUID ${match[1]}.`,
	},
	{
		category: "pipeline",
		kind: "renderer-data",
		pattern: /m_RendererDataList:|ScriptableRendererData|UniversalRendererData|ForwardRendererData/i,
		detail: () => "Defines or references Scriptable Renderer Data.",
	},
])
