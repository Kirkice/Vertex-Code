/**
 * Knowledge Orchestration Types
 *
 * Type definitions for the universal knowledge orchestration system.
 * Supports all modes, not just graphics.
 *
 * @module knowledge/types
 */

/**
 * Domain of knowledge document.
 * - graphics: graphics/rendering specific
 * - general: cross-domain knowledge (mode handoff, validation, etc.)
 */
export type KnowledgeDomain = "graphics" | "general" | "debug" | "architect" | "code"

/**
 * Kind of knowledge document.
 */
export type KnowledgeKind = "reference" | "methodology" | "case-study"

/**
 * A single entry in the universal knowledge index.
 */
export interface KnowledgeEntry {
	/** Unique identifier */
	id: string
	/** Human-readable title */
	title: string
	/** Relative path to the .md file within knowledge/ */
	path: string
	/** Short summary for injection mode */
	summary: string
	/** Kind of knowledge document */
	kind: KnowledgeKind
	/** Domain classification */
	domain: KnowledgeDomain
	/** Tags for categorization */
	tags: string[]
	/** Trigger keywords for routing */
	triggers: string[]
	/** Scenario identifiers */
	scenarios: string[]
	/** Which modes this knowledge applies to */
	modes: string[]
	/** Priority score (higher = more important) */
	priority: number
	/** Related skill IDs */
	relatedSkills: string[]
	/** Related playbook IDs */
	relatedPlaybooks: string[]
	/** Estimated token budget */
	tokenBudget: number
	/** Whether to always include regardless of routing */
	alwaysInclude: boolean
}

/**
 * Result of knowledge routing.
 */
export interface KnowledgeRoutingResult {
	/** Selected knowledge entries */
	entries: KnowledgeEntry[]
	/** Whether to use summary mode */
	useSummary: boolean
	/** Estimated token count */
	estimatedTokens: number
	/** Reasoning */
	reasoning: string
}

/**
 * Injection mode.
 */
export type KnowledgeInjectionMode = "summary" | "full"

/**
 * Options for building a mode prompt with knowledge.
 */
export interface KnowledgePromptBuildOptions {
	/** User's message */
	userMessage: string
	/** Detected intent */
	intent?: string
	/** Current mode slug */
	mode?: string
	/** Max token budget */
	maxKnowledgeTokens?: number
	/** Force full injection */
	forceFullMode?: boolean
}
