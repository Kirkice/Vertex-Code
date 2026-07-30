import { createRuleAnalyzer } from "./GraphicsArchitectureAnalyzer"

export const clientAnalyzer = createRuleAnalyzer("client", [
	{
		category: "client",
		kind: "unity-component",
		pattern: /class\s+(\w+)\s*:\s*(?:MonoBehaviour|ScriptableObject)\b/i,
		symbol: (match) => match[1],
		detail: (match) => `Unity client entry point ${match[1]}.`,
	},
	{
		category: "client",
		kind: "lifecycle",
		pattern: /\b(?:void|IEnumerator|Task)\s+(Awake|OnEnable|Start|Update|LateUpdate|OnDisable|OnDestroy)\s*\(/i,
		symbol: (match) => match[1],
		detail: (match) => `Implements Unity lifecycle method ${match[1]}().`,
	},
])
