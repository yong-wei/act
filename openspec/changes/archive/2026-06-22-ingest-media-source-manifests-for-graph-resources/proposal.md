## Why

The resource center already has ResourceSegment, RetrievalChunk, CitationTarget, ResourceNode graph profiles, and a bounded media manifest contract. The remaining gap is ingestion: videos, audio, slides, and image-based teaching resources need a repeatable manifest pipeline so they can become citation-ready and graph-aware without dumping raw media into runtime.

This change defines media source manifest ingestion for `act` and upstream media repositories such as `yong-wei/videos`.

## What Changes

- Add an ingestion contract for media source manifests.
- Validate video, audio, image, and slides manifests with source refs, segment/timecode/page anchors, transcripts/descriptions, graph bindings, scene availability, citation policy, and AI-use permission.
- Generate ResourceSemanticProjection, RetrievalChunk, CitationTarget, and ResourceNode audit inputs where authorized.
- Keep raw media source ownership outside runtime; runtime consumes generated projections and citation maps.
- Surface missing transcript, anchor, citation policy, or graph binding as limitations.

## Capabilities

### New Capabilities

- `media-source-manifest-ingestion`: Defines media manifest validation and projection into resource center semantics.

### Modified Capabilities

- `resource-segment-scene-binding`: Media segments become graph-aware and scene-aware through manifest ingestion.
- `resource-node-registry`: Ingested media segments may support PlanningUnits only after ResourceNode audit.
- `learning-evidence-rag-corpus`: Media transcripts/descriptions may become retrieval chunks with server-owned CitationAddress metadata.

## Impact

- Affected areas: future `course-content/authoring/resources/media/*`, media manifest scripts, `src/lib/resource-node-registry.ts`, `src/lib/data-governance/learning-evidence-rag-corpus.ts`, runtime resource exporters, and tests.
- Depends on ResourceNode graph profiles, resource segment scene binding, citation verification, and artifact versioning. It is a successor to #640 for the unified graph-path series because media resources must bind to LearningGoals and K/A/Q graph targets.
- Does not implement ASR/OCR automation itself; transcripts/descriptions may be provided by authoring sources.
