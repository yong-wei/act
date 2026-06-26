## 1. Corpus Adapters

- [ ] Map governed `LearningEvidenceCorpusChunk` records to Source Pack candidates.
- [ ] Map textbook/reference runtime search documents to Source Pack candidates.
- [ ] Map resource projection sidecars to Source Pack candidates while preserving review and permission metadata.

## 2. Citation Hydration

- [ ] Resolve Source Pack citation display payloads from server-owned CitationAddress or CitationTarget metadata.
- [ ] Preserve limitations for stale, unsafe, restricted, provisional, or missing citation targets.
- [ ] Reject or mark unsafe citation addresses before serialization.

## 3. Eligibility Separation

- [ ] Carry retrieval/citation readiness separately from path eligibility.
- [ ] Add tests proving retrieval chunks do not become path-plannable nodes without ResourceNode/PlanningUnit audit.
- [ ] Run `openspec validate adapt-governed-corpus-to-source-pack --strict`.
