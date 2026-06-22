## 1. Manifest Contract

- [x] 1.1 Define media source manifest schema for video, audio, image, and slides resources.
- [x] 1.2 Add validation for source refs, segment anchors, transcript/description refs, graph bindings, scene availability, citation policy, privacy, and AI-use permission.
- [x] 1.3 Define limitations for missing transcript, missing anchor, unsafe source, missing graph binding, and blocked AI-use.

## 2. Projection Pipeline

- [x] 2.1 Convert validated media manifests into ResourceSegments, CitationTargets, RetrievalChunks, and ResourceSemanticProjection metadata.
- [x] 2.2 Feed PlanningUnit candidates only through ResourceNode audit.
- [x] 2.3 Preserve runtime/source ownership boundaries and avoid raw media dumps into runtime.

## 3. Verification

- [x] 3.1 Add tests for valid video/audio/slides/image manifests.
- [x] 3.2 Add tests for missing transcript, anchor, citation policy, graph binding, and AI-use limitations.
- [x] 3.3 Add tests proving media RetrievalChunks do not become PathNodes without ResourceNode audit.
- [x] 3.4 Run `rtk openspec validate ingest-media-source-manifests-for-graph-resources --strict`.
