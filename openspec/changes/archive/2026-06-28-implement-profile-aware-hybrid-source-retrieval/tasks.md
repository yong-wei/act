## 1. Retrieval Profiles

- [x] Define Source Pack retrieval profiles and default budgets.
- [x] Apply profile-specific visibility, source type, review-state, and AI-use filters before ranking.
- [x] Add profile tests for authoring, assessment, Konling, and path planning.

## 2. Hybrid Ranking

- [x] Implement exact/lexical, graph/objective, authority, freshness, learner-context, eligibility, and optional semantic score fusion.
- [x] Preserve exact technical matches even when semantic/vector scores are weak or unavailable.
- [x] Add deterministic ranking tests.

## 3. Pack Assembly

- [x] Add source, modality, citation-target, and resource diversity controls.
- [x] Add excerpt and pack-size budgets.
- [x] Add coverage and limitation summaries for missing or excluded evidence.

## 4. Verification

- [x] Add evaluation fixtures for representative course queries and failure modes.
- [x] Run targeted unit tests and `openspec validate implement-profile-aware-hybrid-source-retrieval --strict`.
