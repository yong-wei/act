## 1. Retrieval And Filtering

- [ ] 1.1 Define graph-aware resource retrieval input and output contracts.
- [ ] 1.2 Filter by ResourceNode audit, scene availability, privacy, teacher policy, readiness, citation requirements, and terminal-validation role.
- [ ] 1.3 Keep RetrievalChunk and CitationTarget as semantic signals, not path nodes.

## 2. Ranking

- [ ] 2.1 Implement deterministic feature scoring for graph coverage, capability contribution, evidence potential, learner fit, accessibility, freshness, time cost, and cognitive load.
- [ ] 2.2 Add scene-specific weight groups for path, Konling, diagnosis, and prep-pack.
- [ ] 2.3 Return feature contributions, limitations, and rejection reasons.

## 3. Planner Integration

- [ ] 3.1 Let graph-driven planner consume ranked candidate sets while preserving existing fallback behavior.
- [ ] 3.2 Keep cold-start paths executable when learner overlay is missing or low-confidence.
- [ ] 3.3 Preserve p95 retrieval and ranking target for seed data.

## 4. Verification

- [ ] 4.1 Add tests for deterministic ranking and tie-breaking.
- [ ] 4.2 Add tests that unaudited chunks cannot become path nodes.
- [ ] 4.3 Add tests for low-resource fallback and scene-specific weights.
- [ ] 4.4 Run `rtk openspec validate resource-learner-matching-ranker --strict`.
