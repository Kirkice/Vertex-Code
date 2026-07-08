/**
 * Graphics Knowledge Orchestration
 *
 * Public API for the graphics knowledge management system.
 * Provides knowledge loading, routing, prompt injection, orchestration,
 * and knowledge capture capabilities.
 *
 * @module graphics-agent/knowledge
 */

export type {
	GraphicsKnowledgeEntry,
	KnowledgeKind,
	KnowledgeRoutingResult,
	KnowledgeInjectionMode,
	GraphicsPromptBuildOptions,
} from "./types"

export {
	loadKnowledgeIndex,
	loadKnowledgeContent,
	extractKnowledgeSummary,
	clearKnowledgeCache,
	getAllKnowledgeEntries,
	findKnowledgeById,
} from "./graphicsKnowledgeLoader"

export {
	routeToKnowledge,
	buildKnowledgeSupplement,
} from "./graphicsKnowledgeRouter"

export {
	orchestrateGraphicsKnowledge,
	buildGraphicsContextBlock,
	type GraphicsOrchestrationResult,
} from "./graphicsKnowledgeOrchestrator"

export {
	captureKnowledge,
	listKnowledgeDrafts,
	promoteKnowledgeDraft,
	buildCaptureContent,
	type KnowledgeCaptureRequest,
	type KnowledgeCaptureResult,
} from "./graphicsKnowledgeCapture"
