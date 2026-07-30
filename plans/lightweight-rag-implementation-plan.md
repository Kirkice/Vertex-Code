# Lightweight RAG Implementation Plan for the VSCode Agent

## 1. Objective

Implement a lightweight, TypeScript-first RAG core for the VSCode agent, borrowing the core design ideas from the local [`LlamaIndex`](../../tmp/llama_index/README.md) repository without embedding the full Python framework or introducing a heavyweight RAG platform.

The implementation should:

- Preserve the existing agent and knowledge orchestration flow.
- Reuse the existing code-index and vector-store infrastructure where possible.
- Convert code, Markdown, text, and knowledge documents into a common node model.
- Support incremental ingestion and persistent local state.
- Provide retriever results with scores and source citations.
- Keep indexing asynchronous, cancellable, and optional.
- Leave stable interfaces for a future external vector store, Rust service, or richer retriever.

## 2. Scope

### In scope

- A common `Document` / `KnowledgeNode` model.
- Lightweight document readers for Markdown, text, and code files.
- Structure-aware and bounded-size text chunking.
- Content hashing and incremental ingestion.
- Embedding through the existing embedder abstraction.
- Reuse or adaptation of the existing [`IVectorStore`](../src/services/code-index/interfaces/vector-store.ts:10).
- A small retriever abstraction inspired by LlamaIndex's [`BaseRetriever`](../../tmp/llama_index/llama-index-core/llama_index/core/base/base_retriever.py:34).
- Metadata filtering, top-k retrieval, token budgeting, and source citations.
- Integration with the existing [`knowledgeOrchestrator.ts`](../src/services/knowledge/knowledgeOrchestrator.ts) and [`knowledgeRouter.ts`](../src/services/knowledge/knowledgeRouter.ts).
- Unit tests and lightweight retrieval diagnostics.

### Out of scope for the first iteration

- Embedding models bundled inside the extension.
- A Python LlamaIndex runtime.
- A Rust sidecar or external service.
- A separate vector database product.
- OCR, complex PDF parsing, or Office document extraction.
- Neural reranking.
- Knowledge graphs, recursive retrieval, query fusion, or multi-hop retrieval.
- Multi-tenant knowledge bases and enterprise permission management.
- A complete knowledge-base administration console.

## 3. Design principles borrowed from LlamaIndex

The goal is to implement the concepts, not copy the framework's class hierarchy.

### 3.1 Documents become nodes

All supported knowledge sources should be converted into a common node structure. This follows the separation represented by [`BaseNode`](../../tmp/llama_index/llama-index-core/llama_index/core/schema.py:264), [`TextNode`](../../tmp/llama_index/llama-index-core/llama_index/core/schema.py:765), and [`NodeWithScore`](../../tmp/llama_index/llama-index-core/llama_index/core/schema.py:1035).

### 3.2 Ingestion is a pipeline

Reading, parsing, metadata enrichment, hashing, and embedding should be treated as separate transformations. This follows the lightweight interpretation of [`IngestionPipeline`](../../tmp/llama_index/llama-index-core/llama_index/core/ingestion/__init__.py:1) and [`IngestionCache`](../../tmp/llama_index/llama-index-core/llama_index/core/ingestion/__init__.py:1).

### 3.3 Index and retriever are separate

The vector store stores and searches indexed data; the retriever applies query policy, filtering, thresholds, and result normalization. This follows the separation around [`SimpleVectorStore`](../../tmp/llama_index/llama-index-core/llama_index/core/vector_stores/simple.py:64) and [`BaseRetriever`](../../tmp/llama_index/llama-index-core/llama_index/core/base/base_retriever.py:34).

### 3.4 Retrieval results remain traceable

Every result must retain its source path, line range, document ID, node ID, and score so that the agent can cite the evidence instead of receiving anonymous text.

### 3.5 Configuration is injectable

Embedding, vector storage, parsing, and retrieval policies should be interfaces or narrow adapters. The first implementation may have one default provider, but future providers must not require changes to agent orchestration.

## 4. Target architecture

```text
VSCode Agent
    |
    +-- Existing knowledgeRouter
    |       Determines whether static knowledge or dynamic retrieval is needed
    |
    +-- LightweightRagService
            |
            +-- DocumentReader
            +-- NodeParser
            +-- IngestionPipeline
            +-- IndexManifest / IngestionCache
            +-- VectorStoreAdapter
            +-- Retriever
            +-- CitationFormatter
            +-- RetrievalDiagnostics
```

Runtime flow:

```text
User message
    -> route knowledge source
    -> build retrieval query
    -> retrieve top-k nodes
    -> filter and budget results
    -> format citations
    -> build knowledge context block
    -> existing agent generation flow
```

## 5. Proposed module layout

Create the following lightweight module group under [`src/services/rag`](../src/services/rag):

```text
src/services/rag/
  index.ts
  types.ts
  documentReader.ts
  nodeParser.ts
  ingestionPipeline.ts
  indexManifest.ts
  retriever.ts
  vectorStoreAdapter.ts
  citationFormatter.ts
  ragService.ts
  __tests__/
```

### Module responsibilities

| Module                                                               | Responsibility                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`types.ts`](../src/services/rag/types.ts)                           | Shared document, node, query, result, source, and status types.           |
| [`documentReader.ts`](../src/services/rag/documentReader.ts)         | Read supported files and produce raw documents.                           |
| [`nodeParser.ts`](../src/services/rag/nodeParser.ts)                 | Split documents into bounded, source-aware nodes.                         |
| [`ingestionPipeline.ts`](../src/services/rag/ingestionPipeline.ts)   | Run reading, parsing, hashing, embedding, and upsert operations.          |
| [`indexManifest.ts`](../src/services/rag/indexManifest.ts)           | Persist file hashes, model identity, schema version, and indexing status. |
| [`retriever.ts`](../src/services/rag/retriever.ts)                   | Define retriever behavior and implement the first vector retriever.       |
| [`vectorStoreAdapter.ts`](../src/services/rag/vectorStoreAdapter.ts) | Adapt the existing code-index vector store to generic knowledge nodes.    |
| [`citationFormatter.ts`](../src/services/rag/citationFormatter.ts)   | Format file paths, line ranges, scores, and source labels.                |
| [`ragService.ts`](../src/services/rag/ragService.ts)                 | Public service for ingest, query, status, and clear operations.           |
| [`index.ts`](../src/services/rag/index.ts)                           | Export the public RAG API.                                                |

The exact filenames are not mandatory; the module boundaries are the important part.

## 6. Core data model

The first implementation should define a small, serializable model:

```ts
export type KnowledgeSourceType = "code" | "markdown" | "text" | "knowledge"

export interface KnowledgeDocument {
	id: string
	path: string
	sourceType: KnowledgeSourceType
	title?: string
	contentHash: string
	metadata: Record<string, string | number | boolean>
}

export interface KnowledgeNode {
	id: string
	documentId: string
	text: string
	contentHash: string
	sourcePath: string
	startLine?: number
	endLine?: number
	title?: string
	metadata: Record<string, string | number | boolean>
	embedding?: number[]
}

export interface RetrievedNode {
	node: KnowledgeNode
	score: number
	retriever: string
}

export interface RagQueryOptions {
	topK?: number
	minScore?: number
	sourceTypes?: KnowledgeSourceType[]
	directoryPrefix?: string
	maxTokens?: number
}

export interface RagQueryResult {
	context: string
	nodes: RetrievedNode[]
	sources: RagSource[]
	retrievalMode: string
	diagnostics: RagDiagnostics
}
```

The existing [`PointStruct`](../src/services/code-index/interfaces/vector-store.ts:4) and [`Payload`](../src/services/code-index/interfaces/vector-store.ts:91) already contain most of the required vector and source information. The first adapter should map those types instead of creating a second storage implementation.

## 7. Ingestion design

### 7.1 Supported inputs

The first release supports:

- Workspace code files already accepted by the code index.
- Markdown documents.
- Plain text files.
- Existing project and built-in knowledge documents.

Unsupported formats should be skipped with a diagnostic rather than blocking the full index.

### 7.2 Parsing strategy

Use a conservative parser:

1. Prefer Markdown heading boundaries.
2. Prefer code symbol or function boundaries when the existing processor exposes them.
3. Fall back to fixed character or token windows.
4. Add a small overlap between adjacent nodes.
5. Keep source line ranges accurate.
6. Never create an empty node.

Initial defaults should be configurable but conservative, for example:

- Target chunk size: 800–1,200 tokens.
- Overlap: 100–150 tokens.
- Maximum nodes returned per query: 5–8.
- Maximum injected context: 3,000–5,000 tokens.

These values are starting points, not permanent constants.

### 7.3 Incremental ingestion

For each source file:

1. Compute a content hash.
2. Compare it with the manifest.
3. Skip unchanged files.
4. Delete old nodes for changed or deleted files.
5. Parse and embed only changed nodes.
6. Upsert the new nodes.
7. Update the manifest after successful persistence.

An interrupted run must leave the index marked incomplete, using the same intent as [`markIndexingIncomplete()`](../src/services/code-index/interfaces/vector-store.ts:79) and [`markIndexingComplete()`](../src/services/code-index/interfaces/vector-store.ts:73).

### 7.4 Embedding policy

Do not bundle an embedding model in the extension. Reuse the existing embedder configuration and API provider support.

Embedding requests should:

- Be batched.
- Have a bounded concurrency limit.
- Respect cancellation.
- Be skipped for unchanged nodes.
- Store the model ID and vector dimension in the manifest.

If the embedding model changes, the index must be considered incompatible and rebuilt.

## 8. Vector storage strategy

### First implementation

Adapt the existing [`IVectorStore`](../src/services/code-index/interfaces/vector-store.ts:10):

- Keep `upsertPoints` for node vectors.
- Keep `search` for similarity queries.
- Use payload metadata for document ID, source type, text, path, and line range.
- Use file deletion methods for incremental updates.
- Add metadata filtering through the adapter if the underlying store supports it.

### Persistence

Persist only the minimum additional metadata under the workspace's existing `.roo` area:

```text
.roo/
  rag/
    manifest.json
    status.json
```

Do not duplicate vectors if the existing vector store already persists them.

### Future replacement point

[`vectorStoreAdapter.ts`](../src/services/rag/vectorStoreAdapter.ts) must hide the concrete vector store. This allows a future migration to a local embedded store, an external vector database, or a Rust service without changing the retriever or agent integration.

## 9. Retrieval design

### First retriever

Implement one `VectorRetriever` with:

- Query embedding.
- Top-k search.
- Minimum score filtering.
- Source-type filtering.
- Directory filtering.
- Duplicate node removal.
- Stable score ordering.
- Token budget enforcement.

### Static knowledge fallback

Retain the existing trigger and scenario routing in [`routeToKnowledge()`](../src/services/knowledge/knowledgeRouter.ts:38). If no dynamic index is available, the current static knowledge injection remains the fallback.

### Retrieval routing

The existing [`orchestrateKnowledge()`](../src/services/knowledge/knowledgeOrchestrator.ts:39) should eventually choose among:

- Static knowledge routing.
- Workspace/code retrieval.
- Knowledge-document retrieval.
- No retrieval.

Do not initially introduce a general-purpose router hierarchy. A small explicit decision function is easier to test and maintain.

### Later extensions

Only after measuring the first retriever should the project consider:

- Keyword plus vector hybrid retrieval.
- Reciprocal-rank fusion.
- Reranking.
- Query expansion.
- Recursive or hierarchical retrieval.

## 10. Context and citation design

The retrieved context should be injected through the existing knowledge context mechanism, not through a second prompt system.

Each citation should include:

- A stable source number.
- Workspace-relative path where possible.
- Start and end line.
- Short title or node label.
- Retrieval score for diagnostics, not necessarily for end users.

Example:

```text
[S1] src/services/code-index/manager.ts:120-168
Source type: code
Relevance: 0.82
```

The generated prompt block should distinguish evidence from instructions and should tell the model not to invent information absent from the retrieved sources.

## 11. VSCode lifecycle and performance rules

### Activation

At extension activation:

- Load configuration.
- Load manifest and status.
- Construct the service lazily.
- Do not scan or embed files synchronously.

This follows the existing background initialization pattern in [`extension.ts`](../src/extension.ts:151).

### Background indexing

- Start only when enabled and a workspace is available.
- Run asynchronously.
- Use a cancellation token.
- Limit concurrent reads and embedding requests.
- Debounce file-system events.
- Coalesce multiple changes to the same file.
- Avoid re-indexing files ignored by the existing ignore controller.

### Query path

- Do not scan the workspace during a user query.
- Fail soft when the index is unavailable.
- Fall back to static knowledge or normal agent behavior.
- Return diagnostics without exposing internal errors in the prompt.

### Storage limits

- Index only supported file types.
- Respect ignore rules and configurable size limits.
- Avoid indexing generated, dependency, binary, and build-output directories.
- Provide a clear command to clear and rebuild the index.

## 12. Integration plan

### Phase 1: Define the model

- Add the shared types.
- Add conversion functions from existing code-index payloads.
- Add serialization tests.

### Phase 2: Add readers and node parsing

- Implement Markdown, text, and code readers.
- Implement heading/symbol/fallback chunking.
- Preserve line ranges and metadata.
- Add parser tests for normal, empty, large, and malformed files.

### Phase 3: Add incremental ingestion

- Implement file hashing.
- Implement manifest load/save.
- Implement changed/removed file detection.
- Add cancellation and progress reporting.
- Reuse existing embedder and vector store interfaces.

### Phase 4: Add retrieval

- Implement the retriever interface.
- Add vector retrieval and filtering.
- Add deduplication and token budget logic.
- Add retrieval diagnostics.

### Phase 5: Integrate with knowledge orchestration

- Add a dynamic retrieval branch to the existing orchestration.
- Preserve static knowledge fallback.
- Add citations to the generated knowledge context.
- Ensure no retrieval result means no empty context block.

### Phase 6: Add user-visible status

- Show indexing state in the existing webview state flow.
- Add commands for rebuild, clear, and inspect status.
- Add a compact sources section to relevant agent responses.

### Phase 7: Evaluate and tune

- Build a small representative query set.
- Measure hit quality, latency, embedding cost, and context size.
- Tune chunk size, overlap, top-k, score threshold, and source routing.
- Only then decide whether hybrid retrieval or reranking is justified.

## 13. Testing plan

### Unit tests

- Stable node IDs and content hashes.
- Chunk boundaries and line ranges.
- Metadata preservation.
- Manifest compatibility checks.
- Incremental change detection.
- Retriever filtering and deduplication.
- Token budget enforcement.
- Citation formatting.
- Static fallback behavior.

### Integration tests

- Ingest a small temporary workspace.
- Modify and delete files.
- Reopen the extension state.
- Query and verify source paths and line ranges.
- Simulate unavailable embedding or vector storage.
- Cancel an indexing run.

### Performance checks

- Extension activation time with RAG enabled and disabled.
- Memory usage before and after loading the index.
- Incremental indexing time for one changed file.
- Query latency with a cold and warm index.
- Maximum context size sent to the model.

## 14. Configuration proposal

Keep configuration small in the first release:

```text
rag.enabled: boolean
rag.indexWorkspace: boolean
rag.indexKnowledge: boolean
rag.maxFileSize: number
rag.topK: number
rag.minScore: number
rag.maxContextTokens: number
rag.embeddingProvider: existing provider setting
rag.embeddingModel: existing model setting
```

Avoid exposing chunking and vector-store internals until there is evidence users need them. Provide sensible defaults and a rebuild command when relevant settings change.

## 15. Risks and mitigations

| Risk                                   | Mitigation                                                         |
| -------------------------------------- | ------------------------------------------------------------------ |
| Extension activation becomes slow      | Lazy initialization and background indexing.                       |
| API embedding cost grows unexpectedly  | Incremental hashing, batching, and explicit scope limits.          |
| Index becomes stale                    | File-system events plus manifest verification and rebuild command. |
| Wrong code snippets are injected       | Score threshold, source filters, token budget, and citations.      |
| Existing code index behavior regresses | Use an adapter and preserve current interfaces/tests.              |
| Vector schema changes break old data   | Store schema version, model ID, and dimension in manifest.         |
| RAG increases prompt size              | Strict top-k and token budget enforcement.                         |
| Users cannot understand indexing state | Expose progress, last update, error, and rebuild controls.         |
| Architecture becomes over-engineered   | Implement only one retriever and one vector adapter initially.     |

## 16. Acceptance criteria for the first usable version

The first version is complete when:

- The extension still activates without waiting for indexing.
- A workspace can be indexed in the background.
- Unchanged files do not trigger new embeddings.
- Deleted files no longer appear in retrieval results.
- Queries return a bounded set of relevant nodes.
- Every injected result has a source path and line range when available.
- The existing static knowledge path continues to work.
- The index can be cleared and rebuilt.
- Embedding or vector-store failures fail softly.
- Unit and integration tests cover the core pipeline.

## 17. Recommended implementation decision

Use the following final architecture:

**TypeScript lightweight RAG core + existing code-index/vector-store infrastructure + existing knowledge router.**

Do not import the full Python [`LlamaIndex`](../../tmp/llama_index/README.md) runtime. Implement its essential concepts locally with narrow interfaces. Keep the RAG service behind a stable boundary so that a future Rust implementation can replace ingestion or retrieval without changing the VSCode agent's query contract.

The first milestone should be a working local vector retrieval path with incremental ingestion and citations. Hybrid retrieval, reranking, external services, and advanced indexing should be driven by measured gaps rather than added in advance.

## Implementation Status

### Done

- [x] Added a TypeScript RAG module group under [`src/services/rag`](../src/services/rag).
- [x] Added common document, node, retrieval result, source, and diagnostics types.
- [x] Added content hashing and bounded source-aware node parsing.
- [x] Added a persisted versioned manifest for incremental ingestion.
- [x] Added an ingestion pipeline that skips unchanged files, embeds changed nodes, and upserts vectors through the existing vector-store interface.
- [x] Added a vector retriever that reuses the existing embedder and vector store.
- [x] Added token-budgeted query results and source citations.
- [x] Added [`RagService`](../src/services/rag/ragService.ts) and prompt-ready [`buildRagContextBlock()`](../src/services/rag/ragService.ts:52).
- [x] Exposed initialized code-index dependencies through [`CodeIndexManager.getRagDependencies()`](../src/services/code-index/manager.ts:347).
- [x] Added lazy RAG service creation through [`CodeIndexManager.getRagService()`](../src/services/code-index/manager.ts:353).
- [x] Added optional prompt integration with static knowledge fallback in [`system.ts`](../src/core/prompts/system.ts:105).
- [x] Added the `vertex.rag.enabled` setting, disabled by default.
- [x] Added node parser and citation unit tests.
- [x] `pnpm check-types` passes.
- [x] Added workspace document discovery for Markdown and text files with ignore-rule filtering.
- [x] Started document ingestion asynchronously from the initialized code-index manager when RAG is enabled.
- [x] Added stale manifest and vector cleanup for files that leave the active ingestion scope.
- [x] Added `knowledge` source classification for files under knowledge directories.
- [x] Connected completed code-index file batches to a background RAG refresh trigger.
- [x] Added RAG ingestion cancellation through the code-index manager stop path.
- [x] Added debounced and coalesced RAG refresh scheduling for repeated file batches.
- [x] Added RAG cancellation during manager disposal and extension deactivation.
- [x] Added minimal manager APIs for RAG rebuild, clear, and status inspection.
- [x] Registered `vertex.ragRebuild`, `vertex.ragClear`, and `vertex.ragStatus` commands.
- [x] Rebuilt the shared types package and verified the workspace with `pnpm check-types`.
- [x] Added explicit global `~/.roo/knowledge` discovery alongside workspace documents.
- [x] Updated ingestion path handling so external knowledge roots retain stable absolute source paths.
- [x] Added the built-in bundled knowledge directory as an explicit RAG source root via [`defaultRagDocumentRoots()`](../src/services/rag/documentSources.ts:53).
- [x] Added multi-root document discovery unit tests covering workspace, external, dedup, and ignore filtering.
- [x] Added ingestion pipeline unit tests covering skip-unchanged, stale deletion, re-embed, cancellation, max file size, and external absolute paths.
- [x] Added user-facing status/progress feedback for [`ragRebuild`](../src/activate/registerCommands.ts:197), [`ragClear`](../src/activate/registerCommands.ts:211), and [`ragStatus`](../src/activate/registerCommands.ts:227) commands.
- [x] Added [`VectorRetriever`](../src/services/rag/retriever.ts:4) unit tests covering embedding, missing embedding, sourceType filtering, deduplication, and topK/minScore/directoryPrefix pass-through.
- [x] Added [`RagService`](../src/services/rag/ragService.ts:13) unit tests covering bounded context, token-budget truncation, and `querySafely` fallback.
- [x] Added [`buildRagContextBlock()`](../src/services/rag/ragService.ts:59) unit tests covering source block formatting and empty-result handling.
- [x] Verified the full RAG test suite (26 tests across 5 files) and `pnpm check-types` pass.
- [x] Added fake-timer tests for [`CodeIndexManager.refreshRagIngestion()`](../src/services/code-index/manager.ts:395) covering debounce coalescing, disabled-RAG behavior, pending timer cancellation, and active ingestion abort.
- [x] Exported [`getCommandsMap()`](../src/activate/registerCommands.ts:71) as a test seam and added command handler tests for rebuild, clear, status, unavailable-manager warnings, success feedback, and failure feedback.
- [x] Verified the manager and command suites (31 tests across 2 files) and `pnpm check-types` pass.
- [x] Extracted [`ingestRagDocuments()`](../src/services/code-index/manager.ts:22) as a testable manager ingestion boundary while retaining the same background manager behavior.
- [x] Added manager ingestion integration tests covering real multi-root discovery, source grouping, embedding/upsert, absolute external knowledge paths, per-source manifest persistence, and pre-start cancellation.
- [x] Added system prompt integration tests confirming static knowledge survives disabled RAG and dynamic retrieval failures.
- [x] Verified the combined RAG, manager, command, and prompt suites (72 tests across 9 files) and `pnpm check-types` pass.
- [x] Added a deterministic in-memory retrieval quality fixture with fixed corpus/query mappings and Hit@1, MRR, and unrelated-query rejection gates.
- [x] Tuned the first measured defaults to 4,000-character chunks, 400-character overlap, top-k 6, minimum score 0.4, and a 3,000-token context budget.
- [x] Made [`VectorRetriever.retrieve()`](../src/services/rag/retriever.ts:14) explicitly sort by descending score before deduplication and removed the untyped source-filter path.
- [x] Improved context packing so oversized nodes are skipped and later relevant nodes can still fit within the token budget.
- [x] Fixed Qdrant search payload projection to return `nodeId`, `sourceType`, and `contentHash`, and persisted `contentHash` during RAG ingestion.
- [x] Verified 84 focused retrieval/Qdrant tests, 78 combined RAG/manager/command/prompt tests, and `pnpm check-types` pass.
- [x] Evaluated hybrid retrieval and reranking against the initial fixture: Hit@1 and MRR are both 1.0, so neither is justified for the first implementation.
- [x] Centralized chunking, retrieval, context-budget, and file-size defaults in [`config.ts`](../src/services/rag/config.ts), removing duplicated prompt constants.
- [x] Added bounded runtime resolution for `rag.topK`, `rag.minScore`, and `rag.maxContextTokens`, including fallback behavior for invalid and non-finite values.
- [x] Exposed `vertex.rag.topK`, `vertex.rag.minScore`, and `vertex.rag.maxContextTokens` through the VSCode extension configuration with English localization descriptions.
- [x] Added configuration tests covering defaults, user overrides, and boundary clamping, plus a prompt integration test confirming configured values reach dynamic retrieval.
- [x] Updated the system-prompt RAG mock to retain real configuration behavior and verified all focused RAG/prompt tests (49 tests across 8 files) pass.
- [x] Re-ran workspace type checking after the configuration closure; all 7 type-check tasks pass.

### Todo

- [ ] Expand retrieval quality fixtures with real embedding-provider baselines and larger multilingual/workspace corpora after production telemetry is available.
- [ ] Reconsider hybrid retrieval or reranking only if measured Hit@K/MRR, terminology recall, or user feedback regresses.
