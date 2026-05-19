## 1. Evidence Catalog And Coverage Baseline

- [ ] 1.1 Define the governed evidence source catalog covering `InteractionLog`, `StudentStepResponse`, `SimulationLog`, `UserAnswer`, `AbilityAssessment`, `PromptAssessment`, `DesignSession`, `ArenaSubmission`, `ArenaEvaluationRun`, and `LearningFact`.
- [ ] 1.2 Classify each source by provenance policy, learning scope, value level, profile eligibility, and supported materialization path.
- [ ] 1.3 Add a coverage report command that counts total rows, eligible rows, excluded rows, affected users, time windows, and sample source references without writing data.
- [ ] 1.4 Ensure the report distinguishes real, seed, showcase, demo, and test data where the current schema or payload exposes that information.
- [ ] 1.5 Phase 1 acceptance: a dry-run report can reproduce the current data-source inventory and explain why each source is eligible or excluded.

## 2. Source Adapter Contracts

- [ ] 2.1 Implement normalized evidence candidate types with stable source identity, provenance, value level, timestamps, source references, and optional competency contribution.
- [ ] 2.2 Add an `InteractionLog` adapter that resolves canonical event type from `eventData.eventType` before falling back to top-level `eventType`.
- [ ] 2.3 Add source adapters for `SimulationLog`, `UserAnswer` plus `Question`, `PromptAssessment`, `DesignSession`, and Arena official submission/evaluation sources.
- [ ] 2.4 Report unsupported or partially supported source families instead of silently dropping them.
- [ ] 2.5 Phase 2 acceptance: adapter tests cover canonical event resolution, stable source ids, seed/showcase exclusion, and each high-value source family.

## 3. Historical Materialization

- [ ] 3.1 Add a dry-run-first materialization command that converts eligible evidence candidates into planned `LearningFact` or governed feature writes.
- [ ] 3.2 Add apply mode with idempotency based on deterministic source identity or existing source references.
- [ ] 3.3 Preserve raw source tables unchanged and include source metadata in every generated fact or feature.
- [ ] 3.4 Materialize high-value historical simulation, assessment, prompt/design, Arena, and resource-completion evidence while keeping passive activity out of competency scores.
- [ ] 3.5 Phase 3 acceptance: running apply twice creates no duplicates and reports existing vs newly created records separately.

## 4. Profile Feature Layer

- [ ] 4.1 Decide whether governed features belong in a new table or in `StudentProfileSummary`, and document the chosen schema or payload contract.
- [ ] 4.2 Generate per-user evidence summaries with evidence counts, source windows, refresh time, low-confidence markers, and key aggregate signals.
- [ ] 4.3 Refresh student snapshots or summaries after materialization without forcing high-traffic profile APIs to scan large raw tables.
- [ ] 4.4 Add rebuild logic that can deterministically recompute a user's governed feature summary from the same source window.
- [ ] 4.5 Phase 4 acceptance: profile-ready feature generation is deterministic and exposes freshness, source window, and evidence counts.

## 5. Profile And Recommendation Consumption

- [ ] 5.1 Update profile consumption so ability and recommendation inputs come from governed facts, snapshots, summaries, or feature caches.
- [ ] 5.2 Keep bounded raw-table reads only for recent activity display or explicit drill-down.
- [ ] 5.3 Update recommendation generation to use governed evidence features, stable reason codes, evidence windows, and evidence counts.
- [ ] 5.4 Mark recommendations or profile claims as low-confidence when evidence is sparse or stale.
- [ ] 5.5 Phase 5 acceptance: profile and recommendation responses explain their evidence basis without scanning large raw source tables for core profile computation.

## 6. Governance Visibility And Verification

- [ ] 6.1 Extend admin data-governance reporting with coverage, exclusions, materialized counts, feature freshness, and unsupported source families.
- [ ] 6.2 Add tests for catalog classification, adapter normalization, materialization idempotency, feature generation, and recommendation reason metadata.
- [ ] 6.3 Run targeted data-governance tests, `npm run lint`, `npm run test`, and a strict OpenSpec validation.
- [ ] 6.4 Produce a final evidence summary stating which existing data sources now support profile/recommendation use, which remain context-only, and which remain excluded.
- [ ] 6.5 Phase 6 acceptance: the final report demonstrates a coordinated evidence path from raw source rows to profile-ready facts/features and explainable recommendations.
