import { createRuleAnalyzer } from "./GraphicsArchitectureAnalyzer"

export const shaderAnalyzer = createRuleAnalyzer("shader", [
	{
		category: "shader",
		kind: "shader-include",
		pattern: /#include\s+["<]([^">]+)[">]/i,
		symbol: (match) => match[1],
		detail: (match) => `Includes shader source ${match[1]}.`,
	},
	{
		category: "shader",
		kind: "shader-keyword",
		pattern: /#pragma\s+(?:multi_compile|shader_feature(?:_local)?)\s+([^\r\n]+)/i,
		symbol: (match) => match[1].trim(),
		detail: (match) => `Declares shader variants: ${match[1].trim()}.`,
	},
	{
		category: "shader",
		kind: "shader-pass",
		pattern: /LightMode"\s*=\s*"([^"]+)"/i,
		symbol: (match) => match[1],
		detail: (match) => `Declares LightMode ${match[1]}.`,
	},
])
