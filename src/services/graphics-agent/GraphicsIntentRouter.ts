/**
 * Graphics Intent Router
 *
 * Detects and classifies graphics-related intents from user messages.
 * Routes requests to appropriate graphics workflows based on intent classification.
 *
 * Responsibilities:
 * - Detect graphics intent from user messages
 * - Classify intent into specific categories
 * - Suggest or trigger Graphics Mode when appropriate
 *
 * @module graphics-agent/GraphicsIntentRouter
 */

import type { GraphicsIntent, GraphicsPlaybookId } from "../graphics-provider/GraphicsProviderTypes"
import { GRAPHICS_TRIGGER_KEYWORDS, GRAPHICS_MODE_SLUG } from "./GraphicsModeDefinition"

/**
 * Result of intent detection and classification.
 */
export interface IntentDetectionResult {
	/** Whether this is a graphics-related intent */
	isGraphicsIntent: boolean
	/** The classified intent type, if detected */
	intent?: GraphicsIntent
	/** Specific playbook ID if this is a playbook request */
	playbookId?: GraphicsPlaybookId
	/** Confidence score (0-1) for the detection */
	confidence: number
	/** Whether to suggest switching to Graphics Mode */
	suggestModeSwitch: boolean
	/** Whether to auto-switch to Graphics Mode for this request */
	autoSwitchMode: boolean
}

/**
 * Patterns for specific graphics intents.
 * Each pattern maps to a GraphicsIntent and includes regex patterns for matching.
 */
const INTENT_PATTERNS: Array<{
	intent: GraphicsIntent
	patterns: RegExp[]
	keywords: string[]
}> = [
	{
		intent: "frame_summary",
		patterns: [
			/分析.*帧/i,
			/帧.*概览/i,
			/frame.*summary/i,
			/overview.*frame/i,
		],
		keywords: ["帧分析", "帧概览", "frame summary", "frame overview"],
	},
	{
		intent: "frame_performance",
		patterns: [
			/为什么.*帧.*慢/i,
			/帧.*性能/i,
			/帧.*耗时/i,
			/frame.*slow/i,
			/frame.*performance/i,
			/gpu.*慢/i,
		],
		keywords: ["帧慢", "帧性能", "帧耗时", "frame slow", "gpu slow"],
	},
	{
		intent: "selected_draw_explain",
		patterns: [
			/解释.*draw/i,
			/当前.*draw/i,
			/这个.*draw/i,
			/explain.*draw/i,
			/current.*draw/i,
			/selected.*draw/i,
		],
		keywords: ["解释draw", "当前draw", "这个draw", "explain draw", "current draw"],
	},
	{
		intent: "shader_analysis",
		patterns: [
			/shader.*分析/i,
			/着色器.*分析/i,
			/shader.*慢/i,
			/shader.*performance/i,
		],
		keywords: ["shader分析", "着色器分析", "shader慢", "shader performance"],
	},
	{
		intent: "pipeline_analysis",
		patterns: [
			/pipeline.*分析/i,
			/管线.*分析/i,
			/pipeline.*state/i,
			/渲染管线/i,
		],
		keywords: ["pipeline分析", "管线分析", "pipeline state", "渲染管线"],
	},
	{
		intent: "resource_trace",
		patterns: [
			/资源.*追踪/i,
			/纹理.*从哪/i,
			/resource.*trace/i,
			/texture.*from/i,
		],
		keywords: ["资源追踪", "纹理来源", "resource trace", "texture from"],
	},
	{
		intent: "project_mapping",
		patterns: [
			/对应.*代码/i,
			/owner.*在/i,
			/哪段.*代码/i,
			/map.*to.*code/i,
			/find.*owner/i,
		],
		keywords: ["对应代码", "owner在哪", "哪段代码", "map to code", "find owner"],
	},
	{
		intent: "regression_compare",
		patterns: [
			/对比.*capture/i,
			/回归.*分析/i,
			/compare.*capture/i,
			/regression/i,
		],
		keywords: ["对比capture", "回归分析", "compare capture", "regression"],
	},
	{
		intent: "graphics_playbook",
		patterns: [
			/黑屏/i,
			/阴影.*问题/i,
			/shadow.*issue/i,
			/black.*screen/i,
		],
		keywords: ["黑屏", "阴影问题", "black screen", "shadow issue"],
	},
]

/**
 * Playbook-specific patterns for identifying which playbook to run.
 */
const PLAYBOOK_PATTERNS: Array<{
	playbookId: GraphicsPlaybookId
	patterns: RegExp[]
}> = [
	{
		playbookId: "black_screen",
		patterns: [/黑屏/i, /black.*screen/i, /nothing.*render/i, /空白/i],
	},
	{
		playbookId: "gpu_slow",
		patterns: [/gpu.*慢/i, /gpu.*slow/i, /帧.*慢/i, /frame.*slow/i, /性能.*问题/i],
	},
	{
		playbookId: "heavy_shader",
		patterns: [/shader.*重/i, /shader.*慢/i, /heavy.*shader/i, /shader.*slow/i],
	},
	{
		playbookId: "shadow_issue",
		patterns: [/阴影.*问题/i, /shadow.*issue/i, /shadow.*artifact/i, /阴影.*错误/i],
	},
]

/**
 * Detects graphics intent from a user message.
 *
 * @param message - The user's message text
 * @param currentMode - The current active mode slug
 * @returns Intent detection result with classification and mode switch suggestions
 */
export function detectGraphicsIntent(
	message: string,
	currentMode?: string,
): IntentDetectionResult {
	const lowerMessage = message.toLowerCase()

	// Check for specific intent patterns first (higher confidence)
	for (const { intent, patterns, keywords } of INTENT_PATTERNS) {
		// Check regex patterns
		for (const pattern of patterns) {
			if (pattern.test(message)) {
				const result: IntentDetectionResult = {
					isGraphicsIntent: true,
					intent,
					confidence: 0.9,
					suggestModeSwitch: currentMode !== GRAPHICS_MODE_SLUG,
					autoSwitchMode: currentMode !== GRAPHICS_MODE_SLUG,
				}

				// If this is a playbook intent, try to identify which playbook
				if (intent === "graphics_playbook") {
					const playbookId = detectPlaybookId(message)
					if (playbookId) {
						result.playbookId = playbookId
					}
				}

				return result
			}
		}

		// Check keywords
		for (const keyword of keywords) {
			if (lowerMessage.includes(keyword.toLowerCase())) {
				const result: IntentDetectionResult = {
					isGraphicsIntent: true,
					intent,
					confidence: 0.8,
					suggestModeSwitch: currentMode !== GRAPHICS_MODE_SLUG,
					autoSwitchMode: false, // Lower confidence, only suggest
				}

				if (intent === "graphics_playbook") {
					const playbookId = detectPlaybookId(message)
					if (playbookId) {
						result.playbookId = playbookId
					}
				}

				return result
			}
		}
	}

	// Check for general graphics trigger keywords (lower confidence)
	let keywordMatchCount = 0
	for (const keyword of GRAPHICS_TRIGGER_KEYWORDS) {
		if (lowerMessage.includes(keyword.toLowerCase())) {
			keywordMatchCount++
		}
	}

	if (keywordMatchCount >= 2) {
		// Multiple graphics keywords suggest this is graphics-related
		return {
			isGraphicsIntent: true,
			intent: "frame_summary", // Default to frame summary for ambiguous cases
			confidence: 0.6,
			suggestModeSwitch: currentMode !== GRAPHICS_MODE_SLUG,
			autoSwitchMode: false,
		}
	}

	if (keywordMatchCount === 1) {
		// Single keyword, low confidence
		return {
			isGraphicsIntent: true,
			intent: "frame_summary",
			confidence: 0.4,
			suggestModeSwitch: currentMode !== GRAPHICS_MODE_SLUG,
			autoSwitchMode: false,
		}
	}

	// Not a graphics intent
	return {
		isGraphicsIntent: false,
		confidence: 0,
		suggestModeSwitch: false,
		autoSwitchMode: false,
	}
}

/**
 * Detects which specific playbook to run based on the message.
 *
 * @param message - The user's message text
 * @returns The playbook ID if detected, undefined otherwise
 */
function detectPlaybookId(message: string): GraphicsPlaybookId | undefined {
	for (const { playbookId, patterns } of PLAYBOOK_PATTERNS) {
		for (const pattern of patterns) {
			if (pattern.test(message)) {
				return playbookId
			}
		}
	}
	return undefined
}

/**
 * Checks if a message contains any graphics-related keywords.
 * This is a lightweight check for UI purposes (e.g., showing a hint).
 *
 * @param message - The user's message text
 * @returns True if the message contains graphics keywords
 */
export function containsGraphicsKeywords(message: string): boolean {
	const lowerMessage = message.toLowerCase()
	return GRAPHICS_TRIGGER_KEYWORDS.some((keyword) =>
		lowerMessage.includes(keyword.toLowerCase()),
	)
}
