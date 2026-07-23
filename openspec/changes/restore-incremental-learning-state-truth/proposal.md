## Why

The existing learner-state pipeline already has incremental portrait materialization, student snapshots, class snapshots, and user-facing readers. New secondary events still wait for daily ingestion and later student/class coordinators, while time-only jobs can append a no-recent-evidence compatibility snapshot. That makes an otherwise usable incremental path appear unavailable or replace established state without new evidence.

## What Changes

- After an ingestion batch persists LearningFacts, enqueue a snapshot job for each affected learner instead of waiting for the scheduled active-student scan.
- Treat the existing portrait-v2 incremental materializer as the state-change gate: context-only, duplicate, and unchanged input do not append learner, class, risk, summary, cache, growth, or outbox state.
- When a learner state snapshot actually changes, durably stage and immediately enqueue only that learner's current class snapshot. The existing outbox remains the recovery path.
- Stop scheduler candidate discovery from selecting a learner merely because a rolling window aged out; existing state remains visible until new state-changing evidence is processed.

## Out of Scope

- Append-only journals, generation selectors, projection cutover, historical repair, role/OID/ACL redesign, Redis transport changes, and worker identity changes.
- New evidence sources, scoring formulas, portrait dimensions, class-membership inference, or API contracts.
- Rebuilding historical data or altering the existing full-rebuild/revocation workflow.

## Impact

- `scripts/workers/data-governance-worker.ts` and portrait-v2 materialization behavior.
- Focused worker and portrait tests; existing student and teacher route tests verify that the updated snapshots remain consumable.
- No Prisma migration and no deployment configuration change.
