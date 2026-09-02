## Context

The Assignment public API currently coordinates authoring, submission, review,
and grading but imports `assignment-grading-orchestration` and document-grading
helpers from Data Governance.  Data Governance also legitimately owns evidence
policy, Learning Record writeback, review derivatives, and durable outbox
consumers.  C16 moves only command orchestration; it does not erase that
governance responsibility.

## Goals / Non-Goals

**Goals:**

- Make Assignment the concrete owner of assignment review/grading orchestration.
- Give Data Governance only an explicit approved-snapshot/evidence handoff.
- Preserve all existing lifecycle identities, state transitions, approval and
  privacy rules, and Assessment/Learning Record boundaries.
- Prove removal of the old orchestration authority without a compatibility
  facade.

**Non-Goals:**

- Redefining Assignment lifecycle/review APIs or adding a second use-case set.
- Moving Assessment attempt scoring into Assignment.
- Moving Learning Record projection, evidence policy, derivative, or outbox
  ownership out of Data Governance.
- Changing grading formulas, AI provider behavior, schema, route URLs, or UI.

## Decisions

### 1. Move real orchestration, not the filename

The implementation relocates the command coordination and lineage checks from
`assignment-grading-orchestration.ts` into the existing Assignment application
implementation.  C15's public API calls the Assignment implementation directly;
an adapter that forwards every function to the old module is not accepted.

### 2. Use an approved-snapshot port for governance

After Assignment approval, it passes an immutable approved-snapshot context
(assignment/revision/question/submission/attempt identity, criterion total,
teacher approval, mapping/provenance, and idempotency identity) through a
narrow Data Governance port.  Data Governance revalidates its own evidence
eligibility, privacy, mapping, and Learning Record authorization before any
write.  Assignment routes never write LearningFact directly.

### 3. Preserve Assessment and Learning Record owners

Assessment remains the owner of attempt and assessment semantics; Assignment
uses its public attempt boundary where needed.  Learning Record remains the
owner of current projections and governed fact/writeback policy; Assignment
does not scan raw events or build a competing projection.

### 4. Keep immutable state and retry semantics

The migration reuses existing review, grading run, approval snapshot, outbox,
derivative, release, submission, and attempt records.  Approval/release
transactions retain CAS, idempotency, dedupe, leases, retries, and audit
correlation.  AI machine values and draft totals remain advisory and never
become teacher-approved totals.

### 5. Delete only after all caller classes close

Inventory routes, server actions, Assignment UI, workers, scripts, document
grading, tests, and governance consumers.  The old module is removed only when
all production and required test callers use Assignment or the explicit
approved-snapshot port; a re-export is not a deletion proof.

## Risks / Trade-offs

- [Orchestration extraction drops a lineage check] → compare every identity,
  authorization result, error code, CAS conflict, and idempotent replay.
- [Governance writeback becomes reachable from a route] → keep the approved-
  snapshot port server-only and add import fitness tests.
- [Worker retries duplicate snapshots/outbox commands] → replay concurrent
  approval/release and duplicate-delivery fixtures against the same identities.
- [Document grading has legitimate governance work] → classify each function;
  move command coordination, retain evidence/derivative/policy adapters.

## Migration Plan

1. Freeze function ownership and behavior/caller inventory.
2. Move orchestration into Assignment and expose it through the existing public
  API; introduce only the narrow approved-snapshot port.
3. Migrate routes/workers/scripts/document callers and remove direct old imports.
4. Run lineage, approval, idempotency, outbox, privacy, Assessment, and
  Learning Record boundary tests.
5. Delete the old module/facade at zero callers and record the final map.
6. Before deletion proof, rollback by restoring the last qualified call path;
  never rewrite durable snapshots, submissions, or evidence.

## Open Questions

None.  The approved-snapshot port may be implemented as an existing adapter
shape or a small Assignment-owned interface, but it must not expose raw answer
payloads or bypass governance authorization.
