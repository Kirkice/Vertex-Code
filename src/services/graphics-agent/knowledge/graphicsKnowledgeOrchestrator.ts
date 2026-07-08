/**
 * Graphics Knowledge Orchestrator
 *
 * Unified entry point that combines intent detection, knowledge routing,
 * and Skill/Playbook selection into a single orchestration flow.
 *
 * This is the main API for the graphics knowledge system.
 *
 * @module graphics-agent/knowledge/graphicsKnowledgeOrchestrator
 */

import { detectGraphicsIntent, type IntentDetectionResult } from "../GraphicsIntentRouter"
import { routeToKnowledge, buildKnowledgeSupplement } from "./graphicsKnowledgeRouter"
import type { GraphicsKnowledgeEntry } from "./types"

/**
 * Result of the full graphics orchestration for a single user message.
 */
export interface GraphicsOrchestrationResult {
	/** Intent detection result */
	intent: IntentDetectionResult
	/** Selected knowledge entries */
	knowledgeEntries: GraphicsKnowledgeEntry[]
	/** Formatted knowledge supplement text (ready to inject into prompt) */
	knowledgeSupplement: string
	/** Recommended playbook ID (from intent or knowledge metadata) */
	recommendedPlaybookId?: string
	/** Recommended skill IDs (from knowledge metadata) */
	recommendedSkillIds: string[]
	/** Whether knowledge was injected */
	hasKnowledgeInjection: boolean
	/** Reasoning for the orchestration decisions */
	reasoning: string
}

/**
 * Orchestrate the full graphics knowledge pipeline for a user message.
 *
 * This function:
 * 1. Detects graphics intent from the message
 * 2. Routes to relevant knowledge documents
 * 3. Builds the knowledge supplement text
 * 4. Resolves recommended Skills and Playbooks from knowledge metadata
 * 5. Returns a unified result for the caller to use
 *
 * @param userMessage - The user's message text
 * @param currentMode - The current active mode slug (e.g., "graphics")
 * @returns Orchestration result with intent, knowledge, and recommendations
 */
export function orchestrateGraphicsKnowledge(
	userMessage: string,
	currentMode?: string,
): GraphicsOrchestrationResult {
	// Step 1: Detect intent
	const intentResult = detectGraphicsIntent(userMessage, currentMode)

	// Step 2: Route to knowledge
	const routingResult = routeToKnowledge({
		userMessage,
		intent: intentResult.intent,
	})

	// Step 3: Build knowledge supplement
	const knowledgeSupplement = buildKnowledgeSupplement(routingResult)

	// Step 4: Resolve recommended Skills and Playbooks from knowledge metadata
	const recommendedSkillIds = new Set<string>()
	let recommendedPlaybookId: string | undefined

	for (const entry of routingResult.entries) {
		// Collect related skills
		for (const skillId of entry.relatedSkills) {
			recommendedSkillIds.add(skillId)
		}

		// Collect related playbooks (use the first one found)
		if (!recommendedPlaybookId && entry.relatedPlaybooks.length > 0) {
			recommendedPlaybookId = entry.relatedPlaybooks[0]
		}
	}

	// If intent detected a specific playbook, prefer that over knowledge metadata
	if (intentResult.playbookId) {
		recommendedPlaybookId = intentResult.playbookId
	}

	// Step 5: Build reasoning
	const reasoningParts: string[] = []
	reasoningParts.push(`Intent: ${intentResult.intent || "none"} (confidence: ${intentResult.confidence})`)
	reasoningParts.push(`Knowledge: ${routingResult.entries.length} entries selected`)
	if (recommendedPlaybookId) {
		reasoningParts.push(`Playbook: ${recommendedPlaybookId}`)
	}
	if (recommendedSkillIds.size > 0) {
		reasoningParts.push(`Skills: ${[...recommendedSkillIds].join(", ")}`)
	}

	return {
		intent: intentResult,
		knowledgeEntries: routingResult.entries,
		knowledgeSupplement,
		recommendedPlaybookId,
		recommendedSkillIds: [...recommendedSkillIds],
		hasKnowledgeInjection: routingResult.entries.length > 0,
		reasoning: reasoningParts.join(" | "),
	}
}

/**
 * Build a context block that can be injected into the conversation
 * when processing a user message in Graphics Mode.
 *
 * This is designed to be added as a system-level context message
 * or as a prefix to the user message.
 *
 * @param userMessage - The user's message text
 * @param currentMode - The current active mode slug
 * @returns Formatted context block string, or empty string if no knowledge matched
 */
export function buildGraphicsContextBlock(
	userMessage: string,
	currentMode?: string,
): string {
	const result = orchestrateGraphicsKnowledge(userMessage, currentMode)

	if (!result.hasKnowledgeInjection) {
		return ""
	}

	const parts: string[] = []

	parts.push("<graphics-knowledge-context>")
	parts.push(`<!-- Orchestration: ${result.reasoning} -->`)

	if (result.recommendedPlaybookId) {
		parts.push(`<!-- Recommended playbook: ${result.recommendedPlaybookId} -->`)
	}

	if (result.recommendedSkillIds.length > 0) {
		parts.push(`<!-- Recommended skills: ${result.recommendedSkillIds.join(", ")} -->`)
	}

	parts.push("")
	parts.push(result.knowledgeSupplement)
	parts.push("</graphics-knowledge-context>")

	return parts.join("\n")
}
