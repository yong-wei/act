## 1. Feature Cache

- [x] 1.1 Add simulation/Arena feature derivation from governed `LearningFact.contextJson` summaries and trace references.
- [x] 1.2 Include recent and all-time windows, source coverage, replay confidence, official/preview distinction, and weak metric summaries.
- [x] 1.3 Add deterministic rebuild tests for unchanged governed simulation/Arena evidence.

## 2. Personalization

- [x] 2.1 Expose simulation/Arena-derived reason metadata in profile or recommendation outputs.
- [x] 2.2 Mark low-confidence, preview-only, standalone-only, stale, or partial simulation evidence explicitly.
- [x] 2.3 Add tests that context-only events cannot produce high-confidence competency claims.

## 3. Teacher Diagnostics

- [x] 3.1 Add teacher class insight coverage fields for simulation/Arena evidence readiness, weak metrics, and replay confidence.
- [x] 3.2 Add student drilldown summaries with trace references but without raw trace payloads or hidden official evaluation leakage.
- [x] 3.3 Add scoped teacher insight tests for class authorization and hidden-data protection.

## 4. Validation

- [x] 4.1 Run focused feature-cache, personalization, and teacher evidence governance tests touched by this change.
- [x] 4.2 Run `rtk proxy openspec validate materialize-simulation-features-for-personalization --strict`.
