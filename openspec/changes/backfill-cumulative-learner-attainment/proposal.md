## Why

The semester has ended, so most students will not produce new facts inside the
recent observation window. Historical `LearningFact` evidence must therefore
be materialized into native portrait v2 records and a separately versioned
current-class aggregate, instead of making completed learning appear absent.

## What Changes

- Add an operator-controlled cumulative-attainment backfill that rebuilds
  portrait v2 from every historical `LearningFact` for eligible students.
- Add a cumulative class competency materialization that uses the current
  roster and valid native portrait v2 records without overwriting the existing
  recent class snapshot.
- Make teacher insights and heatmap endpoints default to the cumulative
  attainment scope, while preserving the recent scope as an explicit view.
- Label cumulative capability results and distinguish them from recent
  activity, risk, classroom-quality, and trend semantics.

## Capabilities

### New Capabilities

- `cumulative-learner-attainment-backfill`: Safely schedule, recover, and
  verify an all-history learner portrait rebuild followed by current-roster
  cumulative class aggregation.

### Modified Capabilities

- `adaptive-learner-state-service`: Student-facing portrait delivery exposes
  the generated cumulative portrait state without treating absence of recent
  facts as absence of historical evidence.
- `teacher-evidence-governance`: Teacher class insight and heatmap delivery
  support cumulative and recent scopes, with cumulative attainment as the
  default and recent-only signals kept semantically separate.

## Impact

- Affected code: data-governance rebuild requests, BullMQ worker jobs,
  portrait/class snapshot materialization, operator scripts, teacher APIs, and
  teacher/student analytics surfaces.
- APIs: teacher insight and heatmap routes accept `scope=cumulative|recent`;
  omitted scope becomes `cumulative`.
- Storage: existing portrait v2, class snapshot, rebuild-request, Redis, and
  BullMQ infrastructure are reused; no schema migration or raw fact rewrite is
  required.
