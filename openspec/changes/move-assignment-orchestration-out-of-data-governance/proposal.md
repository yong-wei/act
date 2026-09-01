## Why

`src/lib/data-governance/assignment-grading-orchestration.ts` still owns
assignment review/grading command coordination even after Assignment gained a
public lifecycle surface.  This reverses domain ownership: a governance module
can assemble assignment state and routes can depend on it instead of the
Assignment owner.

## What Changes

- Move concrete assignment grading/review orchestration into the existing
  Assignment application owner established by C15.
- Keep Data Governance responsible only for governed evidence policy, approved
  snapshot adaptation, Learning Record writeback, and its existing derivative/
  outbox consumers.
- Replace direct Data Governance orchestration callers with Assignment-owned
  use cases and a narrow approved-snapshot handoff.
- Preserve Assignment revision/question/submission/attempt lineage, approval
  snapshots, idempotency/CAS, outbox/retry semantics, AI-draft advisory status,
  and Assessment/Learning Record owner boundaries.
- Delete the old orchestration authority and any forwarding facade once all
  callers are migrated and the zero-caller proof is recorded.

## Capabilities

### New Capabilities

- `assignment-orchestration-governance-boundary`: Defines the Assignment versus
  Data Governance ownership boundary and approved-snapshot handoff.

### Modified Capabilities

None.  The existing Assignment lifecycle/review contracts, Assessment owner,
and Learning Record boundaries remain unchanged; this is an implementation
ownership migration.

## Impact

- Affects `src/lib/data-governance/assignment-grading-orchestration.ts`,
  `src/lib/assignments/public-api.ts` and review/grading modules, assignment
  routes/workers, document-grading adapters, evidence/outbox consumers, and
  related tests.
- Depends on `complete-assignment-lifecycle-owner-consolidation` (C15), the
  existing Assessment attempt owner, and the Learning Record current
  projection/writeback boundary.
- C16 unlocks `simplify-student-assignment-workspace` and
  `simplify-teacher-review-and-grading-workspace`; C17 remains a parallel UI
  simplification directly after C15.
- No new Assignment API, LearningFact writer, grading state, database model,
  worker protocol, scoring rule, or public route is introduced.
