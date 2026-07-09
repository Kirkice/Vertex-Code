/**
 * Knowledge Orchestration
 *
 * Public API for the universal knowledge management system.
 * Supports all modes and domains.
 *
 * @module knowledge
 */

export type {
	KnowledgeEntry,
	KnowledgeDomain,
	KnowledgeKind,
	KnowledgeRoutingResult,
	KnowledgeInjectionMode,
	KnowledgePromptBuildOptions,
} from "./types"

export {
	loadKnowledgeIndex,
	loadKnowledgeContent,
	extractKnowledgeSummary,
	clearKnowledgeCache,
	getAllKnowledgeEntries,
	findKnowledgeById,
	getKnowledgeEntriesForMode,
} from "./knowledgeLoader"

export {
	routeToKnowledge,
	buildKnowledgeSupplement,
} from "./knowledgeRouter"

export {
	orchestrateKnowledge,
	buildKnowledgeContextBlock,
	type KnowledgeOrchestrationResult,
} from "./knowledgeOrchestrator"

export {
	captureKnowledge,
	listKnowledgeDrafts,
	buildCaptureContent,
	type KnowledgeCaptureRequest,
	type KnowledgeCaptureResult,
} from "./knowledgeCapture"
