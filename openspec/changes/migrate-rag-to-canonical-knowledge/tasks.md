## 1. Add Canonical retrieval signals

- [ ] 1.1 Implement Canonical entity alignment using IDs, names, aliases, the current aggregate ReleaseSet, and version-matched CourseCoverage.
- [ ] 1.2 Add bounded expansion for explicitly supported engineering predicates.
- [ ] 1.3 Resolve upstream RAG-reference seeds only through the governed ACT EvidenceStructuralUnitCrosswalk to structural units, RetrievalChunks, and CitationTargets.
- [ ] 1.4 Preserve existing lexical, vector, reranking, and evidence-adjudication stages.

## 2. Enforce citation ownership

- [ ] 2.1 Require final citations to resolve to accessible ACT structural text units or anchors.
- [ ] 2.2 Reject graph summaries, relations, and unresolved upstream RAG references as final answer evidence.
- [ ] 2.3 Add diagnostics for missing or drifted Crosswalks without Legacy fallback.
- [ ] 2.4 Emit standard numbered citations targeting the most specific available textbook structure.

## 3. Validate retrieval quality

- [ ] 3.1 Build an offline sample covering direct entity matches, relation expansion, unsupported predicates, and missing Crosswalks.
- [ ] 3.2 Run shadow comparisons against the current production RAG without mixing results for users.
- [ ] 3.3 Add a RAG authority selector that remains Legacy before final cutover and add negative tests against local Canonical activation.
- [ ] 3.4 Run real textbook answer and citation E2E, latency checks, targeted tests, typecheck, and strict OpenSpec validation.
