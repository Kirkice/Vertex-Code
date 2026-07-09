/**
 * Graphics Knowledge Types
 *
 * Type definitions for the graphics knowledge orchestration system.
 * Defines the structure of knowledge index entries and routing results.
 *
 * @module graphics-agent/knowledge/types
 */

/**
 * Kind of knowledge document.
 * - reference: foundational theory (PBR, color science, math)
 * - methodology: analysis frameworks (performance analysis, debugging methodology)
 * - case-study: specific problem cases (DPCF/PCSS stability, TAA ghosting)
 */
export type KnowledgeKind = "reference" | "methodology" | "case-study"

/**
 * A single entry in the graphics knowledge index.
 * Each entry describes one knowledge document and its routing metadata.
 */
export interface GraphicsKnowledgeEntry {
	/** Unique identifier for this knowledge entry */
	id: string
	/** Human-readable title */
	title: string
	/** Relative path to the .md file within knowledge/ */
	path: string
	/** Short summary for use in summary injection mode */
	summary: string
	/** Kind of knowledge document */
	kind: KnowledgeKind
	/** Domain classification (graphics entries are filtered from the universal knowledge index) */
	domain?: string
	/** Tags for categorization */
	tags: string[]
	/** Trigger keywords for routing (case-insensitive matching) */
	triggers: string[]
	/** Scenario identifiers for intent-based routing */
	scenarios: string[]
	/** Which modes this knowledge applies to */
	modes?: string[]
	/** Priority score (higher = more important, used for conflict resolution) */
	priority: number
	/** Related skill IDs */
	relatedSkills: string[]
	/** Related playbook IDs */
	relatedPlaybooks: string[]
	/** Estimated token budget for this document */
	tokenBudget: number
	/** Whether to always include this document regardless of routing */
	alwaysInclude: boolean
}

/**
 * Result of knowledge routing for a specific user message.
 */
export interface KnowledgeRoutingResult {
	/** The knowledge entries selected for injection */
	entries: GraphicsKnowledgeEntry[]
	/** Whether to use summary mode (true) or full mode (false) */
	useSummary: boolean
	/** Total estimated token count of selected entries */
	estimatedTokens: number
	/** Reasoning for the routing decision */
	reasoning: string
}

/**
 * Injection mode for knowledge documents.
 * - summary: inject only the summary and key conclusions
 * - full: inject the entire document content
 */
export type KnowledgeInjectionMode = "summary" | "full"

/**
 * Options for building the graphics mode prompt with knowledge.
 */
export interface GraphicsPromptBuildOptions {
	/** The user's message text */
	userMessage: string
	/** The detected graphics intent, if any */
	intent?: string
	/** Maximum token budget for knowledge injection */
	maxKnowledgeTokens?: number
	/** Force full injection mode for all selected entries */
	forceFullMode?: boolean
}
