## Why

The platform currently has two portrait semantics. `StudentCompetencySnapshot`
and student profile pages still use the legacy six-dimensional
`CompetencyVector`, while K/A/Q graph work already defines seven portrait v2
dimensions for goals, graph nodes, and future learner overlays.

This split causes real regressions. Evidence such as `diagnosticAssessment`
can be valid for resources and objectives but invisible to the displayed
profile, and new evidence can collapse the visible portrait back to a partial
six-dimensional vector.

## What Changes

- Promote the seven-dimension portrait v2 contract to the primary learner
  portrait model for new learner-state, profile, path-planning, and Konling
  consumers.
- Define the canonical persisted portrait v2 shape, ids, labels, evidence
  summary, confidence, freshness, source lineage, and migration version.
- Make legacy six-dimensional compatibility read-only during migration and
  explicitly non-authoritative for new writes.
- Require tests proving the seven portrait dimensions are the only primary
  profile dimensions exposed by new contracts.

## Impact

- Affects learner-state contracts, profile APIs, data-governance snapshots,
  K/A/Q objective taxonomy, and tests.
- Does not yet migrate existing rows or change every consumer; later changes
  in this series handle incremental updates, migration, and UI/runtime wiring.
