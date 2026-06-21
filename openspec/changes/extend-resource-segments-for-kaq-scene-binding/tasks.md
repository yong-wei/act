## 1. ResourceNode Graph Profile

- [ ] 1.1 Extend ResourceNode or ResourceSemanticProjection with graph refs, scene availability, citation readiness, evidence capability, and limitations.
- [ ] 1.2 Extend PlanningUnit projection to preserve path profile, readiness, evidence, and governance fields.
- [ ] 1.3 Update audits to distinguish linked, retrievable, citable, and path-eligible states.

## 2. Segment Binding

- [ ] 2.1 Add segment binding types for textbook, handout, video, audio, image, slides, exercise, simulation, and Arena source refs.
- [ ] 2.2 Add segment scene binding validation for path, Konling, diagnosis, grading, prep-pack, and report use.
- [ ] 2.3 Ensure CitationTarget and RetrievalChunk projection cannot bypass ResourceNode planning audit.

## 3. Media Manifest Boundary

- [ ] 3.1 Define media manifest fields for future `videos` repository ingestion.
- [ ] 3.2 Validate transcript or timecode anchor readiness separately from citation verification.
- [ ] 3.3 Document that full ASR/OCR and bulk media import are out of scope.

## 4. Verification

- [ ] 4.1 Add tests for ResourceNode graph profile projection.
- [ ] 4.2 Add tests proving a citable chunk is not automatically path eligible.
- [ ] 4.3 Add tests for scene availability filtering.
- [ ] 4.4 Run `rtk openspec validate extend-resource-segments-for-kaq-scene-binding --strict`.
