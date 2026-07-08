/**
 * Graphics Knowledge Router
 *
 * Routes user messages to relevant graphics knowledge documents.
 * Uses trigger keywords and scenario matching to select appropriate knowledge.
 *
 * @module graphics-agent/knowledge/graphicsKnowledgeRouter
 */

import type { GraphicsKnowledgeEntry, KnowledgeRoutingResult, GraphicsPromptBuildOptions } from "./types"
import { loadKnowledgeIndex, loadKnowledgeContent, extractKnowledgeSummary } from "./graphicsKnowledgeLoader"

/**
 * Default maximum token budget for knowledge injection.
 */
const DEFAULT_MAX_KNOWLEDGE_TOKENS = 3000

/**
 * Maximum number of knowledge entries to inject at once.
 */
const MAX_KNOWLEDGE_ENTRIES = 3

/**
 * Route a user message to relevant graphics knowledge entries.
 *
 * The routing algorithm:
 * 1. Always include entries with `alwaysInclude: true`
 * 2. Match user message against each entry's `triggers` (case-insensitive)
 * 3. If intent is provided, match against `scenarios`
 * 4. Sort matched entries by priority (descending)
 * 5. Cap at MAX_KNOWLEDGE_ENTRIES
 * 6. Apply token budget constraints
 *
 * @param options - Build options including user message and intent
 * @returns Routing result with selected entries and injection mode
 */
export function routeToKnowledge(options: GraphicsPromptBuildOptions): KnowledgeRoutingResult {
	const { userMessage, intent, maxKnowledgeTokens = DEFAULT_MAX_KNOWLEDGE_TOKENS, forceFullMode } = options
	const lowerMessage = userMessage.toLowerCase()
	const index = loadKnowledgeIndex()

	// Phase 1: Always-include entries
	const alwaysIncluded = index.filter((entry) => entry.alwaysInclude)

	// Phase 2: Trigger-based matching
	const triggerMatched: Array<{ entry: GraphicsKnowledgeEntry; score: number }> = []

	for (const entry of index) {
		if (entry.alwaysInclude) continue

		let score = 0

		// Check trigger keywords
		for (const trigger of entry.triggers) {
			if (lowerMessage.includes(trigger.toLowerCase())) {
				score += 1
			}
		}

		// Check scenario matching if intent is provided
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

	// Phase 3: Sort by score (descending), then by priority (descending)
	triggerMatched.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score
		return b.entry.priority - a.entry.priority
	})

	// Phase 4: Combine always-included + top matched, cap at MAX
	const selected: GraphicsKnowledgeEntry[] = [...alwaysIncluded]
	const remainingSlots = MAX_KNOWLEDGE_ENTRIES - selected.length

	for (let i = 0; i < Math.min(remainingSlots, triggerMatched.length); i++) {
		selected.push(triggerMatched[i].entry)
	}

	// Phase 5: Determine injection mode
	// Use summary mode by default; use full mode if:
	// - forceFullMode is true
	// - only 1 entry is selected and it has high priority
	const useSummary = !forceFullMode && selected.length > 1

	// Phase 6: Apply token budget
	let estimatedTokens = 0
	const budgetedEntries: GraphicsKnowledgeEntry[] = []

	for (const entry of selected) {
		const entryTokens = useSummary ? Math.min(entry.tokenBudget, 400) : entry.tokenBudget
		if (estimatedTokens + entryTokens <= maxKnowledgeTokens) {
			budgetedEntries.push(entry)
			estimatedTokens += entryTokens
		}
	}

	// Build reasoning
	const reasoning = buildRoutingReasoning(budgetedEntries, triggerMatched, useSummary)

	return {
		entries: budgetedEntries,
		useSummary,
		estimatedTokens,
		reasoning,
	}
}

/**
 * Build the knowledge supplement section for the graphics mode prompt.
 *
 * @param routingResult - The routing result from routeToKnowledge
 * @returns A formatted string to append to the graphics mode prompt
 */
export function buildKnowledgeSupplement(routingResult: KnowledgeRoutingResult): string {
	if (routingResult.entries.length === 0) {
		return ""
	}

	const sections: string[] = []

	sections.push("\n## Relevant Knowledge Base\n")
	sections.push("The following knowledge documents are relevant to the current question. Use them as reference for your analysis and recommendations.\n")

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
 * Build a human-readable reasoning string for the routing decision.
 */
function buildRoutingReasoning(
	selected: GraphicsKnowledgeEntry[],
	matched: Array<{ entry: GraphicsKnowledgeEntry; score: number }>,
	useSummary: boolean,
): string {
	if (selected.length === 0) {
		return "No knowledge entries matched the user message."
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
