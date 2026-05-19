## Context

Recent database inspection showed that out-of-class data exists in multiple raw tables: tens of thousands of `SimulationLog` and `UserAnswer` rows, standalone `InteractionLog` rows, prompt/design assessment records, and Arena submissions. The profile-ready governance layer sees only a small subset because there is no shared catalog describing which raw sources are eligible, trustworthy, high-value, or only useful as activity context.

This change creates the baseline inventory and policy layer. It intentionally stops before backfill or profile consumption, because source eligibility and seed/showcase exclusion must be auditable before mutation.

## Goals / Non-Goals

**Goals:**

- Define a machine-readable source catalog for existing learning evidence sources.
- Classify each source by provenance policy, scope, value level, profile eligibility, and materialization readiness.
- Add a dry-run coverage report for current data volume, affected users, time windows, and exclusions.
- Establish canonical event resolution for `InteractionLog`.
- Make low-value event policy explicit.

**Non-Goals:**

- Writing new `LearningFact` rows from historical data.
- Adding feature caches or profile summary schema changes.
- Changing recommendation behavior.
- Replacing the existing competency model.
- Cleaning or deleting historical raw rows.

## Decisions

### Decision 1: Catalog before conversion

Source classification must precede materialization. The current raw data includes real and showcase-derived records; converting first would risk polluting student profiles.

### Decision 2: Keep the first phase read-only

The coverage report should not mutate data. It should provide counts, samples, and exclusion reasons so later changes can be reviewed against concrete evidence.

### Decision 3: Use canonical event type for interaction logs

Many current `InteractionLog` rows use top-level wrapper types such as `view` or `interact` while the real event family lives in `eventData.eventType`. The catalog and report must use the canonical type so resource, knowledge, and Arena activity is not undercounted.

### Decision 4: Separate value policy from source existence

A source being present does not mean it should affect competency scores. The catalog should distinguish high-value scored outcomes, medium-value process evidence, and low-value navigation context.

## Risks / Trade-offs

- [Risk] Provenance cannot be inferred for every historical row. -> Report unknown provenance explicitly instead of treating it as real by default.
- [Risk] A read-only phase may feel incomplete. -> It reduces risk for later materialization and gives reviewable acceptance evidence.
- [Risk] Catalog rules may become stale. -> Keep catalog generation tested and visible through the coverage report.

## Migration Plan

1. Add catalog definitions and source classification helpers.
2. Add the coverage report command.
3. Validate against the current synced database.
4. Surface coverage or unsupported source summary in admin governance reporting if practical.
5. Use this report as the input for the next materialization change.
