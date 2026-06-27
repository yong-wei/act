## Design

Adapters convert governed records into Source Pack candidates. They do not own raw content and do not decide final path eligibility. They preserve source refs and limitation states so the Source Pack builder can later rank, diversify, and serialize candidates while keeping citation verification server-owned.

## Adapter Inputs

- `LearningEvidenceCorpusChunk` for teaching knowledge and learner evidence.
- Textbook and reference runtime search documents produced from authoring resources.
- Resource projection sidecars that already declare `ResourceSegment`, `CitationTarget`, and `RetrievalChunk` metadata.
- ResourceNode registry metadata when a path-plannable PlanningUnit exists.

## Citation Hydration

Hydration resolves labels, display titles, hrefs, address kinds, figure/equation/page anchors, freshness, and limitation state from server-owned metadata. Model output and CLI arguments may request citations, but they do not author verified citation URLs.

## Eligibility Boundary

Retrieval candidates may be useful for evidence but still not path-plannable. The adapter must carry both `citationReady` and `pathEligible` style signals without promoting a chunk or citation target into a path node.
