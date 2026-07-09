## Design Notes

Primary consumers should read portrait v2 through a shared service or adapter
instead of re-deriving dimensions locally. Consumer groups include:

- student profile home and ability portrait
- growth center and learning records
- evidence review pages
- personalized recommendation generation, recommendation rationale, and
  `LearningRecommendation` persistence
- adaptive learner-state service
- `StudentEvidenceFeatureCache` approved aggregates and fallback payloads
- adaptive path planner weak-dimension personalization
- Konling learner context and citation/evidence diagnostics
- class-level competency aggregation, teacher insights, and analytics-v2
- teacher/student diagnostics where they expose learner portrait summaries
- data completeness helpers and tests

The UI should present seven dimensions. If a learner only has migrated legacy
data, the UI may show a limitation or confidence label, but it should not fall
back to six cards as the primary experience.

Gates should detect new primary writes or direct primary reads of legacy
six-dimensional vectors. Legacy compatibility adapters should be explicitly
named and exempted only for migration, historic backfill, or archive views.

`StudentEvidenceFeatureCache` needs a payload version bump or equivalent
compatibility marker so old six-dimensional `approvedAggregates.latestSnapshot`
payloads cannot re-enter learner-state as primary `primaryCompetencies`.

Class-level aggregation should compute teacher-visible dimensions from portrait
v2. If a class contains migrated compatibility rows, teacher surfaces should
show limitation metadata instead of mixing six-dimensional labels with
seven-dimensional student profiles.

## Verification Strategy

- API contract tests proving profile and learner-state endpoints return seven
  dimensions.
- Planner tests proving weak-dimension personalization uses portrait v2 ids.
- Konling tests proving learner-context summaries use portrait v2.
- Recommendation tests proving weak-dimension rationale uses portrait v2 ids.
- Evidence cache tests proving portrait v2 payload versioning and fallback
  behavior.
- Teacher insight tests proving class aggregation uses portrait v2 labels.
- Static or unit gate detecting new legacy primary usage.
- Browser or component tests for student profile seven-card rendering.
