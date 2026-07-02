## 1. Corpus Adapters

- [x] Map governed `LearningEvidenceCorpusChunk` records to Source Pack candidates.
- [x] Map textbook/reference runtime search documents to Source Pack candidates.
- [x] Map resource projection sidecars to Source Pack candidates while preserving review and permission metadata.

## 2. Citation Hydration

- [x] Resolve Source Pack citation display payloads from server-owned CitationAddress or CitationTarget metadata.
- [x] Preserve limitations for stale, unsafe, restricted, provisional, or missing citation targets.
- [x] Reject or mark unsafe citation addresses before serialization.

## 3. Eligibility Separation

- [x] Carry retrieval/citation readiness separately from path eligibility.
- [x] Add tests proving retrieval chunks do not become path-plannable nodes without ResourceNode/PlanningUnit audit.
- [x] Run `openspec validate adapt-governed-corpus-to-source-pack --strict`.
