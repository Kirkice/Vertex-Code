/**
 * Knowledge Orchestrator
 *
 * Unified entry point for knowledge orchestration across all modes.
 * Combines routing, injection, and capture into a single flow.
 *
 * @module knowledge/knowledgeOrchestrator
 */

import { routeToKnowledge, buildKnowledgeSupplement } from "./knowledgeRouter"
import type { KnowledgeEntry, KnowledgePromptBuildOptions } from "./types"

/**
 * Result of knowledge orchestration.
 */
export interface KnowledgeOrchestrationResult {
	/** Selected knowledge entries */
	knowledgeEntries: KnowledgeEntry[]
	/** Formatted knowledge supplement text */
	knowledgeSupplement: string
	/** Recommended skill IDs */
	recommendedSkillIds: string[]
	/** Recommended playbook IDs */
	recommendedPlaybookIds: string[]
	/** Whether knowledge was injected */
	hasKnowledgeInjection: boolean
	/** Reasoning */
	reasoning: string
}

/**
 * Orchestrate knowledge for a user message in a given mode.
 *
 * @param userMessage - User's message
 * @param mode - Current mode slug
 * @param intent - Optional detected intent
 * @returns Orchestration result
 */
export function orchestrateKnowledge(
	userMessage: string,
	mode?: string,
	intent?: string,
): KnowledgeOrchestrationResult {
	const routingResult = routeToKnowledge({ userMessage, intent, mode })
	const knowledgeSupplement = buildKnowledgeSupplement(routingResult)

	const recommendedSkillIds = new Set<string>()
	const recommendedPlaybookIds = new Set<string>()

	for (const entry of routingResult.entries) {
		for (const skillId of entry.relatedSkills) {
			recommendedSkillIds.add(skillId)
		}
		for (const playbookId of entry.relatedPlaybooks) {
			recommendedPlaybookIds.add(playbookId)
		}
	}

	const reasoningParts: string[] = []
	reasoningParts.push(`Knowledge: ${routingResult.entries.length} entries selected`)
	if (recommendedPlaybookIds.size > 0) {
		reasoningParts.push(`Playbooks: ${[...recommendedPlaybookIds].join(", ")}`)
	}
	if (recommendedSkillIds.size > 0) {
		reasoningParts.push(`Skills: ${[...recommendedSkillIds].join(", ")}`)
	}

	return {
		knowledgeEntries: routingResult.entries,
		knowledgeSupplement,
		recommendedSkillIds: [...recommendedSkillIds],
		recommendedPlaybookIds: [...recommendedPlaybookIds],
		hasKnowledgeInjection: routingResult.entries.length > 0,
		reasoning: reasoningParts.join(" | "),
	}
}

/**
 * Build a context block for injection into conversation.
 */
export function buildKnowledgeContextBlock(
	userMessage: string,
	mode?: string,
	intent?: string,
): string {
	const result = orchestrateKnowledge(userMessage, mode, intent)

	if (!result.hasKnowledgeInjection) {
		return ""
	}

	const parts: string[] = []

	parts.push("<knowledge-context>")
	parts.push(`<!-- Orchestration: ${result.reasoning} -->`)

	if (result.recommendedPlaybookIds.length > 0) {
		parts.push(`<!-- Recommended playbooks: ${result.recommendedPlaybookIds.join(", ")} -->`)
	}

	if (result.recommendedSkillIds.length > 0) {
		parts.push(`<!-- Recommended skills: ${result.recommendedSkillIds.join(", ")} -->`)
	}

	parts.push("")
	parts.push(result.knowledgeSupplement)
	parts.push("</knowledge-context>")

	return parts.join("\n")
}
