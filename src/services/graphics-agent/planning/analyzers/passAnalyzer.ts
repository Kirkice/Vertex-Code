import { createRuleAnalyzer } from "./GraphicsArchitectureAnalyzer"

export const passAnalyzer = createRuleAnalyzer("pass", [
	{
		category: "pass",
		kind: "renderer-feature",
		pattern: /class\s+(\w+)\s*:\s*ScriptableRendererFeature\b/i,
		symbol: (match) => match[1],
		detail: (match) => `Renderer Feature class ${match[1]}.`,
	},
	{
		category: "pass",
		kind: "render-pass",
		pattern: /class\s+(\w+)\s*:\s*ScriptableRenderPass\b/i,
		symbol: (match) => match[1],
		detail: (match) => `Scriptable Render Pass class ${match[1]}.`,
	},
	{
		category: "pass",
		kind: "pass-injection-point",
		pattern: /renderPassEvent\s*=\s*RenderPassEvent\.(\w+)/i,
		symbol: (match) => match[1],
		detail: (match) => `Injects a render pass at RenderPassEvent.${match[1]}.`,
	},
	{
		category: "pass",
		kind: "custom-pass",
		pattern: /class\s+(\w+)\s*:\s*CustomPass\b/i,
		symbol: (match) => match[1],
		detail: (match) => `HDRP Custom Pass class ${match[1]}.`,
	},
	{
		category: "pass",
		kind: "render-graph",
		pattern: /RecordRenderGraph\s*\(|AddRasterRenderPass\s*<|AddComputePass\s*</i,
		detail: () => "Uses a Render Graph recording or pass registration entry point.",
	},
])
