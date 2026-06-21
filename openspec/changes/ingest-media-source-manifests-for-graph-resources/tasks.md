## 1. Manifest Contract

- [ ] 1.1 Define media source manifest schema for video, audio, image, and slides resources.
- [ ] 1.2 Add validation for source refs, segment anchors, transcript/description refs, graph bindings, scene availability, citation policy, privacy, and AI-use permission.
- [ ] 1.3 Define limitations for missing transcript, missing anchor, unsafe source, missing graph binding, and blocked AI-use.

## 2. Projection Pipeline

- [ ] 2.1 Convert validated media manifests into ResourceSegments, CitationTargets, RetrievalChunks, and ResourceSemanticProjection metadata.
- [ ] 2.2 Feed PlanningUnit candidates only through ResourceNode audit.
- [ ] 2.3 Preserve runtime/source ownership boundaries and avoid raw media dumps into runtime.

## 3. Verification

- [ ] 3.1 Add tests for valid video/audio/slides/image manifests.
- [ ] 3.2 Add tests for missing transcript, anchor, citation policy, graph binding, and AI-use limitations.
- [ ] 3.3 Add tests proving media RetrievalChunks do not become PathNodes without ResourceNode audit.
- [ ] 3.4 Run `rtk openspec validate ingest-media-source-manifests-for-graph-resources --strict`.
