## Why

Even after portrait v2 exists and data is migrated, the platform can remain in
a split-brain state if profile pages, adaptive path planning, Konling context,
data completeness helpers, and tests still read six-dimensional snapshots as
the primary learner portrait.

The old model must be retired from primary consumer paths. Compatibility can
remain for migration and historic reads, but student-facing and planning-facing
logic should consume portrait v2.

## What Changes

- Update learner profile, growth center, evidence review, path planning, and
  Konling learner-context consumers to use primary portrait v2.
- Update recommendation generation, `LearningRecommendation` rationale,
  `StudentEvidenceFeatureCache`, and class-level competency aggregation to use
  portrait v2 as their primary portrait source.
- Add compatibility adapters only where legacy reads are required.
- Add gates preventing new code from writing or exposing six-dimensional
  `CompetencyVector` as the primary portrait.
- Update tests and docs so seven portrait v2 dimensions are the expected
  student-facing model.

## Impact

- Affects frontend profile surfaces, learner-state service consumers,
  recommendation generation, evidence feature cache, class competency
  snapshots, adaptive path planner personalization, Konling context, data
  completeness gates, tests, and documentation.
- Depends on the model, incremental update, and migration changes.
- Does not remove historical database columns unless the implementation proves
  it is safe; the requirement is to retire legacy primary usage.
