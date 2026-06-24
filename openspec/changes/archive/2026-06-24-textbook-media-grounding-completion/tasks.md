## 1. Textbook Completion

- [x] 1.1 Define textbook section candidate schema with page anchors and source hashes.
- [x] 1.2 Add human-reviewed graph and capability binding workflow for section candidates.
- [x] 1.3 Generate CitationTargets and RetrievalChunks from reviewed sections.
- [x] 1.4 Promote selected reviewed sections to `textbook_section` ResourceNodes only when path fields are complete.
- [x] 1.5 Emit source package, denominator, source window, review batch id, source hash, and limitation reason for every in-scope textbook section candidate.

## 2. Media Projection Consumption

- [x] 2.1 Consume ResourceSegment, CitationTarget, RetrievalChunk, and ResourceSemanticProjection outputs from `ingest-media-source-manifests-for-graph-resources`.
- [x] 2.2 Verify consumed media projections include anchor, graph refs, scene availability, citation policy, AI-use permission, authority, privacy scope, review state, source version, tool/version where applicable, input scope, output hash, retention rule, and limitation state.
- [x] 2.3 Ensure raw media, generated summaries, prompt-derived metadata, and provisional local-model semantics remain separate from human-confirmed path fields.
- [x] 2.4 Block private media ingestion code in this change; missing upstream media projections must produce limitations.

## 3. RAG And Citation Integration

- [x] 3.1 Index grounded textbook and media segments into the governed RAG corpus.
- [x] 3.2 Verify citations through server-owned CitationAddress metadata.
- [x] 3.3 Expose missing citation or review limitations to Konling and diagnostics.
- [x] 3.4 Ensure student-facing citations do not expose raw file paths, prompt text, tool internals, or governance diagnostics.
- [x] 3.5 Write grounding artifacts to `course-content/runtime/resource-governance/textbook-section-grounding-candidates.jsonl`, `textbook-section-citation-targets.jsonl`, and `textbook-media-grounding-limitations.json`.

## 4. Verification

- [x] 4.1 Add tests for textbook section citation readiness and path promotion.
- [x] 4.2 Add tests proving consumed media RetrievalChunks cannot become PathNodes without ResourceNode audit.
- [x] 4.3 Add tests for missing upstream media projection, provisional review state, unsafe citation address, and forbidden raw media ingestion.
- [x] 4.4 Add artifact snapshots for source package counts, denominator, source window, limitation reasons, and review status.
- [x] 4.5 Run `rtk openspec validate textbook-media-grounding-completion --strict`.
- [x] 4.6 Run `rtk npm run test:unit -- src/lib/__tests__/textbook-media-grounding.test.ts src/lib/__tests__/runtime-resource-projections.test.ts src/lib/data-governance/__tests__/learning-evidence-rag-corpus.test.ts`.
- [x] 4.7 Verify OpenSpec issue dependency metadata with `/Users/YW/Documents/Project/OpenSpec-buddy/skills/openspec-buddy/scripts/verify-issue-relationships.sh` after issue creation.
