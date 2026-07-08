## 1. Source Pack Relevance Gate

- [ ] 1.1 Add a `konling-answer` answer-relevance gate that requires exact, lexical, graph-node, capability-target, resource, learner/SAR candidate, or semantic relevance before an item can become a selected answer citation.
- [ ] 1.2 Record answer-relevance audit evidence for selected `konling-answer` citations, including pass/fail state, basis, bounded match evidence, query hash, and selected-node or SAR summary where available.
- [ ] 1.3 Emit auditable Source Pack limitations when no selected item satisfies answer relevance, while preserving ordinary visibility, review, AI-use, answer-leakage, citation-readiness, budget, and diversity policies.

## 2. Konling Runtime Integration

- [ ] 2.1 Update Konling citation-context construction so irrelevant or absent Source Pack content citations are omitted from answer generation, citation verification, and student-visible citation chips instead of surfaced as high-confidence answer evidence.
- [ ] 2.2 Preserve missing citation and relevance audit reasons in runtime metadata, readiness, and citation guard output without exposing privileged diagnostics to students.

## 3. Regression Coverage

- [ ] 3.1 Add Source Pack unit tests that reproduce high-authority canonical textbook chunks losing to the answer-relevance gate when the user query and graph context are unrelated.
- [ ] 3.2 Add Source Pack unit tests proving non-`konling-answer` profiles retain their existing retrieval semantics.
- [ ] 3.3 Add Konling runtime tests covering `/knowledge` selected-node context, no-relevant-citation degradation, privacy-safe student text, and explicit guards against `ch01-advanced-problems-031__chunk-001` or sibling `ADVANCED PROBLEMS` rows appearing by default.

## 4. Validation

- [ ] 4.1 Run `rtk npm run test:unit -- src/lib/__tests__/source-pack-hybrid-retriever.test.ts src/lib/__tests__/konling-agent-runtime.test.ts`.
- [ ] 4.2 Run `rtk npm run typecheck`.
- [ ] 4.3 Run `rtk /Users/YW/Documents/Project/OpenSpec-buddy/skills/openspec-buddy/scripts/validate-issue-body.mjs openspec/changes/govern-konling-answer-citation-relevance/.buddy/issue.md`.
- [ ] 4.4 Run `rtk openspec validate govern-konling-answer-citation-relevance --strict` and update implementation evidence before review.
