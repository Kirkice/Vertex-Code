/**
 * Knowledge Router
 *
 * Routes user messages to relevant knowledge documents across all modes.
 * Filters by mode applicability, then matches by triggers and scenarios.
 *
 * @module knowledge/knowledgeRouter
 */

import type { KnowledgeEntry, KnowledgeRoutingResult, KnowledgePromptBuildOptions } from "./types"
import { loadKnowledgeIndex, loadKnowledgeContent, extractKnowledgeSummary } from "./knowledgeLoader"

/**
 * Default maximum token budget for knowledge injection.
 */
const DEFAULT_MAX_KNOWLEDGE_TOKENS = 3000

/**
 * Maximum number of knowledge entries to inject at once.
 */
const MAX_KNOWLEDGE_ENTRIES = 3

/**
 * Route a user message to relevant knowledge entries.
 *
 * Algorithm:
 * 1. Filter entries by mode (if mode is provided)
 * 2. Always include entries with `alwaysInclude: true`
 * 3. Match user message against each entry's `triggers`
 * 4. If intent is provided, match against `scenarios`
 * 5. Sort by score, then priority
 * 6. Cap at MAX_KNOWLEDGE_ENTRIES
 * 7. Apply token budget
 *
 * @param options - Build options including user message, intent, and mode
 * @returns Routing result with selected entries
 */
export function routeToKnowledge(options: KnowledgePromptBuildOptions): KnowledgeRoutingResult {
	const { userMessage, intent, mode, maxKnowledgeTokens = DEFAULT_MAX_KNOWLEDGE_TOKENS, forceFullMode } = options
	const lowerMessage = userMessage.toLowerCase()
	let index = loadKnowledgeIndex()

	// Filter by mode if provided
	if (mode) {
		index = index.filter((entry) => entry.modes.includes(mode) || entry.modes.length === 0)
	}

	// Phase 1: Always-include entries
	const alwaysIncluded = index.filter((entry) => entry.alwaysInclude)

	// Phase 2: Trigger-based matching
	const triggerMatched: Array<{ entry: KnowledgeEntry; score: number }> = []

	for (const entry of index) {
		if (entry.alwaysInclude) continue

		let score = 0

		for (const trigger of entry.triggers) {
			if (lowerMessage.includes(trigger.toLowerCase())) {
				score += 1
			}
		}

		if (intent) {
			for (const scenario of entry.scenarios) {
				if (intent.toLowerCase().includes(scenario.toLowerCase()) || scenario.toLowerCase().includes(intent.toLowerCase())) {
					score += 2
				}
			}
		}

		if (score > 0) {
			triggerMatched.push({ entry, score })
		}
	}

	// Phase 3: Sort
	triggerMatched.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score
		return b.entry.priority - a.entry.priority
	})

	// Phase 4: Combine and cap
	const selected: KnowledgeEntry[] = [...alwaysIncluded]
	const remainingSlots = MAX_KNOWLEDGE_ENTRIES - selected.length

	for (let i = 0; i < Math.min(remainingSlots, triggerMatched.length); i++) {
		selected.push(triggerMatched[i].entry)
	}

	// Phase 5: Determine injection mode
	const useSummary = !forceFullMode && selected.length > 1

	// Phase 6: Token budget
	let estimatedTokens = 0
	const budgetedEntries: KnowledgeEntry[] = []

	for (const entry of selected) {
		const entryTokens = useSummary ? Math.min(entry.tokenBudget, 400) : entry.tokenBudget
		if (estimatedTokens + entryTokens <= maxKnowledgeTokens) {
			budgetedEntries.push(entry)
			estimatedTokens += entryTokens
		}
	}

	const reasoning = buildRoutingReasoning(budgetedEntries, triggerMatched, useSummary)

	return {
		entries: budgetedEntries,
		useSummary,
		estimatedTokens,
		reasoning,
	}
}

/**
 * Build the knowledge supplement section for prompt injection.
 */
export function buildKnowledgeSupplement(routingResult: KnowledgeRoutingResult): string {
	if (routingResult.entries.length === 0) {
		return ""
	}

	const sections: string[] = []

	sections.push("\n## Relevant Knowledge Base\n")
	sections.push("The following knowledge documents are relevant to the current question. Use them as reference.\n")

	for (const entry of routingResult.entries) {
		sections.push(`### ${entry.title}\n`)

		if (routingResult.useSummary) {
			const summary = extractKnowledgeSummary(entry)
			sections.push(summary)
		} else {
			const content = loadKnowledgeContent(entry)
			sections.push(content || entry.summary)
		}

		sections.push("")
	}

	return sections.join("\n")
}

/**
 * Build reasoning string.
 */
function buildRoutingReasoning(
	selected: KnowledgeEntry[],
	matched: Array<{ entry: KnowledgeEntry; score: number }>,
	useSummary: boolean,
): string {
	if (selected.length === 0) {
		return "No knowledge entries matched."
	}

	const parts: string[] = []
	parts.push(`Selected ${selected.length} knowledge entr${selected.length === 1 ? "y" : "ies"}.`)

	if (matched.length > 0) {
		const topMatch = matched[0]
		parts.push(`Top match: "${topMatch.entry.title}" (score: ${topMatch.score}, priority: ${topMatch.entry.priority}).`)
	}

	parts.push(`Injection mode: ${useSummary ? "summary" : "full"}.`)

	return parts.join(" ")
}
