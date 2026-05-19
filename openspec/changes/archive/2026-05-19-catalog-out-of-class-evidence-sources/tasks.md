## 1. Evidence Source Catalog

- [x] 1.1 Define catalog entries for `InteractionLog`, `StudentStepResponse`, `SimulationLog`, `UserAnswer`, `AbilityAssessment`, `PromptAssessment`, `DesignSession`, `ArenaSubmission`, `ArenaEvaluationRun`, and `LearningFact`.
- [x] 1.2 Classify each source by provenance policy, learning scope, evidence value level, profile eligibility, and materialization readiness.
- [x] 1.3 Define low-value activity policy so passive views, navigation, and leaderboard browsing remain context-only.
- [x] 1.4 Define canonical event type resolution for `InteractionLog` using `eventData.eventType` before top-level wrapper type.

## 2. Coverage Report

- [x] 2.1 Add a dry-run coverage report command that reads current data sources without writing records.
- [x] 2.2 Report total rows, eligible rows, excluded rows, unsupported rows, affected users, first/last timestamps, and sample source references.
- [x] 2.3 Report seed, showcase, demo, test, real, and unknown provenance where inferable from schema or payload.
- [x] 2.4 Report classroom-bound, standalone, out-of-class, historical, and mixed source scopes.

## 3. Admin And Verification

- [x] 3.1 Expose or document the coverage output so admin data-governance review can see source coverage and exclusions.
- [x] 3.2 Add focused tests for catalog classification, canonical event resolution, source eligibility, and coverage aggregation.
- [x] 3.3 Run targeted data-governance tests, `npm run lint`, `npm run test`, and `openspec validate catalog-out-of-class-evidence-sources --strict`.
- [x] 3.4 Phase acceptance: the report reproduces the current evidence inventory and explains which sources are eligible, excluded, unsupported, or context-only.
