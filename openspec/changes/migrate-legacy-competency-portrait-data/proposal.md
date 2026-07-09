## Why

After portrait v2 becomes the primary model, existing production and fixture
data still contain legacy six-dimensional snapshots, sparse LearningFact
contributions, and fixture-specific records such as Yang Fan diagnostic data.
If those rows are not migrated, users can continue to see partial or regressed
portraits even after the new model exists.

The migration must preserve evidence lineage and avoid fabricating mastery.
Legacy values should be converted with explicit mapping confidence and
limitations, while fixture data should be corrected so future worker runs
recompute the same intended portrait rather than overwriting it.

## What Changes

- Add migration/backfill tooling from legacy six-dimensional snapshots to
  primary seven-dimensional portrait v2 records.
- Migrate or regenerate Yang Fan diagnostic fixture facts so they cover the
  official portrait v2 dimensions and no longer rely on non-displayed
  `diagnosticAssessment` as profile evidence.
- Add verification helpers that report migrated, native, stale, and unmigrated
  portrait rows.
- Keep duplicate-account handling scoped by canonical identifiers rather than
  name-only matches.

## Impact

- Affects database migration/backfill scripts, data governance helpers, fixture
  generation, Yang Fan test account readiness, and validation tests.
- Depends on the primary portrait v2 model and incremental update semantics.
- Does not adapt every UI consumer; the next change handles consumer wiring.
