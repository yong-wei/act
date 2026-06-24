## 1. ResourceNode Graph Profile

- [x] 1.1 Extend ResourceNode or ResourceSemanticProjection with graph refs, scene availability, citation readiness, evidence capability, and limitations.
- [x] 1.2 Extend PlanningUnit projection to preserve path profile, readiness, evidence, and governance fields.
- [x] 1.3 Update audits to distinguish linked, retrievable, citable, and path-eligible states.

## 2. Segment Binding

- [x] 2.1 Add segment binding types for textbook, handout, video, audio, image, slides, exercise, simulation, and Arena source refs.
- [x] 2.2 Add segment scene binding validation for path, Konling, diagnosis, grading, prep-pack, and report use.
- [x] 2.3 Ensure CitationTarget and RetrievalChunk projection cannot bypass ResourceNode planning audit.

## 3. Media Manifest Boundary

- [x] 3.1 Define media manifest fields for future `videos` repository ingestion.
- [x] 3.2 Validate transcript or timecode anchor readiness separately from citation verification.
- [x] 3.3 Document that full ASR/OCR and bulk media import are out of scope.

## 4. Verification

- [x] 4.1 Add tests for ResourceNode graph profile projection.
- [x] 4.2 Add tests proving a citable chunk is not automatically path eligible.
- [x] 4.3 Add tests for scene availability filtering.
- [x] 4.4 Run `rtk openspec validate extend-resource-segments-for-kaq-scene-binding --strict`.
