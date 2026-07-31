import { createRuleAnalyzer } from "./GraphicsArchitectureAnalyzer"

/**
 * Finds client-side entry points that connect rendering features to runtime state.
 * The rules intentionally identify conventions rather than attempting compilation.
 */
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
	{
		category: "client",
		kind: "camera-entry",
		pattern: /\b(?:Camera\.main|GetComponent\s*<\s*Camera\s*>|CinemachineCamera|UniversalAdditionalCameraData|ScriptableRendererFeature)\b/i,
		detail: () => "Connects runtime behavior to a camera or camera renderer entry point.",
	},
	{
		category: "client",
		kind: "resource-loading",
		pattern: /\b(?:Resources\.Load(?:Async)?|Addressables\.(?:Load|Instantiate)(?:Async)?|AssetBundle\.(?:Load|LoadAsset))\b/i,
		detail: () => "Loads or instantiates graphics resources through a runtime asset-loading entry point.",
	},
	{
		category: "client",
		kind: "object-pool",
		pattern: /\b(?:ObjectPool\s*<|LinkedPool\s*<|IObjectPool\s*<|Get\s*\(\)|Release\s*\()\b/i,
		detail: () => "Uses an object-pooling convention that may control graphics instance lifetime.",
	},
])
