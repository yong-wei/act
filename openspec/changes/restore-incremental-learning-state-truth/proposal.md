## Why

Learner and class analytics currently treat the absence of evidence in a rolling 30-day window as a new negative lifecycle state. This overwrites or hides valid long-term learning state, contradicts the incremental portrait contract, and has already made historically evidenced classes appear empty.

The repair must stop time-only state changes and migrate affected historical records into the current portrait-v2 and class-competency projections. A display-only fallback is insufficient because workers would continue writing misleading snapshots and downstream consumers could continue selecting them as truth.

## What Changes

- Define an effective-state rule: without new governed evidence, materializers do not create a replacement learning-state snapshot and consumers continue using the latest valid state.
- Persist materialization processing cursors independently from learner-state snapshots so context-only facts are consumed exactly once without manufacturing state changes.
- Journal evidence creation, governed revocation, authorization changes, and relevant durable downstream/user actions in an append-only database-ordered change stream so late facts and deleted sources cannot escape processing or rollback synchronization.
- Reserve capability decreases and no-evidence transitions for explicit governed negative evidence or auditable evidence revocation, never elapsed time alone.
- Separate evidence freshness and latest-snapshot timestamps from capability truth so interfaces can disclose age without erasing or suppressing established state.
- Align student portrait-v2, legacy compatibility projections, class competency snapshots, teacher insights, dashboards, recommendations, summaries, caches, growth records, risks, and outbox work with the same effective-state semantics.
- Add versioned side-by-side projections and an atomic active-version gate so migration, activation, and rollback do not expose partially converted state or overwrite the previous generation.
- Add an idempotent migration and repair workflow that freezes a source cutoff and record set, distinguishes provable time-only errors from revocations and ambiguous history, reconstructs current projections from authoritative lineage and historical class-scoped evidence, preserves superseded records for audit, and records migration provenance.
- Add dry-run reports, invariants, restartability, and production verification so historical data can be corrected without silently fabricating evidence or crossing class scope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `adaptive-learner-state-service`: Tighten incremental update semantics, define effective snapshot selection, prohibit time-only replacement snapshots, and require auditable idempotent repair of affected legacy and erroneous projections.
- `teacher-evidence-governance`: Require teacher class and student insights to retain the latest valid class-scoped learning state when no new evidence exists, expose its snapshot date and freshness separately, and distinguish genuine revocation from inactivity.

## Impact

- Data-governance scheduler and workers for student, portrait-v2, class, recommendation, summary, cache, and outbox materialization.
- Teacher class dashboard, class insights, student insight, student competency/profile consumers, and shared snapshot-selection helpers.
- PostgreSQL append-only change-journal, transactional scope-counter, snapshot, processing-cursor, projection-version, activation, before-image/lineage, and repair-operation records, plus a versioned repair script/report for production and locally imported production data.
- Data-governance unit and integration tests, route tests, migration fixtures, operational runbook, and post-migration verification queries.
- No new learning evidence source, capability dimension, actual class-membership mutation, or raw-data exposure is introduced.
