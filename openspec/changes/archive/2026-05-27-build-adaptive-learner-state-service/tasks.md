## 1. Contracts and Data

- [x] 1.1 Define learner-state TypeScript contracts for primary competencies, second-level dimensions, knowledge mastery, resource preference, media absorption, path context, risks, evidence windows, confidence, and privacy scope.
- [x] 1.2 Define quantification dictionaries for value ranges, source families, algorithm versions, evidence thresholds, confidence policies, and fallback reasons.
- [x] 1.3 Extend StudentEvidenceFeatureCache payload versioning for adaptive learner-state feature groups.

## 2. Service and Consumers

- [x] 2.1 Implement learner-state read service from governed facts, snapshots, profile summaries, assessment records, feature cache, path feedback, and prerequisite simulation/Arena feature groups.
- [x] 2.2 Add role-scoped learner-state APIs.
- [x] 2.3 Update path-planner, personalization, profile, and Konling consumers to use the service where enabled.

## 3. Validation

- [x] 3.1 Add tests for missing/stale/partial/low-confidence evidence, privacy-scoped reads, client-hint non-authority, and simulation/Arena feature consumption without redefinition.
- [x] 3.2 Validate with `rtk proxy openspec validate build-adaptive-learner-state-service --strict`.
