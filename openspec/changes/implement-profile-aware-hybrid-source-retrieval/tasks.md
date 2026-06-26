## 1. Retrieval Profiles

- [ ] Define Source Pack retrieval profiles and default budgets.
- [ ] Apply profile-specific visibility, source type, review-state, and AI-use filters before ranking.
- [ ] Add profile tests for authoring, assessment, Konling, and path planning.

## 2. Hybrid Ranking

- [ ] Implement exact/lexical, graph/objective, authority, freshness, learner-context, eligibility, and optional semantic score fusion.
- [ ] Preserve exact technical matches even when semantic/vector scores are weak or unavailable.
- [ ] Add deterministic ranking tests.

## 3. Pack Assembly

- [ ] Add source, modality, citation-target, and resource diversity controls.
- [ ] Add excerpt and pack-size budgets.
- [ ] Add coverage and limitation summaries for missing or excluded evidence.

## 4. Verification

- [ ] Add evaluation fixtures for representative course queries and failure modes.
- [ ] Run targeted unit tests and `openspec validate implement-profile-aware-hybrid-source-retrieval --strict`.
