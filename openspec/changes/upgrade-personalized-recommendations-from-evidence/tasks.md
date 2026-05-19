## 1. Consumer Inventory And Read Boundary

- [ ] 1.1 Identify profile, recommendation, teacher-insight, and admin explanation consumers that use raw or fragmented evidence.
- [ ] 1.2 Route core evidence reads through governed facts, snapshots, summaries, or student evidence feature cache data.
- [ ] 1.3 Keep raw source-table reads only for audit, debug, migration, or drilldown paths.
- [ ] 1.4 Preserve existing recommendation scope; do not add a new recommendation engine.

## 2. Explanation Metadata

- [ ] 2.1 Add reason codes for recommendation/profile claims that are derived from governed evidence.
- [ ] 2.2 Include evidence windows, evidence counts, source coverage, and confidence markers where relevant.
- [ ] 2.3 Surface low-confidence, stale, missing, or partial evidence states instead of presenting precise recommendations from incomplete data.
- [ ] 2.4 Keep passive views and navigation as context-only rationale unless an explicit contribution rule exists.

## 3. Verification

- [ ] 3.1 Add focused tests for governed evidence reads, reason-code generation, fallback states, and raw-read boundaries.
- [ ] 3.2 Manually verify representative student profile and recommendation outputs against known evidence-cache states.
- [ ] 3.3 Run targeted profile/recommendation tests, `npm run lint`, `npm run test`, and `openspec validate upgrade-personalized-recommendations-from-evidence --strict`.
- [ ] 3.4 Phase acceptance: visible personalization is evidence-driven, explainable, and honest about confidence without introducing a new recommender.
