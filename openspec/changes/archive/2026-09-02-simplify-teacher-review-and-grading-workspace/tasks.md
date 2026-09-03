## 1. Understand and baseline

- [x] 1.1 Read queue, review workspace, grade workspace, grading console,
  public API, review contracts, and history; enumerate action/state paths.
- [x] 1.2 Capture before metrics: lines, components/functions, branches,
  duplicate request/render paths, state transitions, imports, and behavior.
- [x] 1.3 Freeze tests for lineage, authorization, current attempts, criteria,
  annotations, CAS/idempotency, approval, return, release, completeness,
  partial feedback, privacy, and accessibility.

## 2. Apply code simplification

- [x] 2.1 Invoke the `code-simplification` skill with the frozen behavior,
  trust boundaries, target workspace, characterization tests, permitted
  deletion set, and explicit prohibition on adjacent refactoring.
- [x] 2.2 Simplify queue/open/reload and availability branches with named
  predicates and guard clauses without changing authorization or errors.
- [x] 2.3 Deduplicate criterion/annotation/save/conflict action handling only
  where scope, CAS, idempotency, and side effects are identical.
- [x] 2.4 Simplify approval/return/release and projection branches while keeping
  teacher score authority, AI advisory state, completeness blockers, and
  partial feedback explicit.
- [x] 2.5 Preserve Assignment API ownership, Assessment attempt semantics,
  Learning Record/evidence boundary, outbox, privacy, and recovery states.
- [x] 2.6 Reject pure file splitting, speculative abstractions, or cosmetic
  edits as completion evidence.

## 3. Compare and verify

- [x] 3.1 Run focused queue/workspace/console tests after each logical change.
- [x] 3.2 Compare command payloads, lineage/auth errors, score totals, approval
  snapshots, partial release, outbox/evidence status, and accessibility.
- [x] 3.3 Record after metrics and a before/after map for accepted, rejected,
  and deferred transformations.

## 4. Handoff

- [x] 4.1 Run Assignment, Assessment, Learning Record boundary, route/UI,
  typecheck, lint, build, strict validation, and `git diff --check`.
- [x] 4.2 Record residual UI/test gaps without changing lifecycle or governance
  contracts.
