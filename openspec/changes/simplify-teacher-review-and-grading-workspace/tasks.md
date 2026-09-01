## 1. Understand and baseline

- [ ] 1.1 Read queue, review workspace, grade workspace, grading console,
  public API, review contracts, and history; enumerate action/state paths.
- [ ] 1.2 Capture before metrics: lines, components/functions, branches,
  duplicate request/render paths, state transitions, imports, and behavior.
- [ ] 1.3 Freeze tests for lineage, authorization, current attempts, criteria,
  annotations, CAS/idempotency, approval, return, release, completeness,
  partial feedback, privacy, and accessibility.

## 2. Apply code simplification

- [ ] 2.1 Invoke the `code-simplification` skill with the frozen behavior,
  trust boundaries, target workspace, characterization tests, permitted
  deletion set, and explicit prohibition on adjacent refactoring.
- [ ] 2.2 Simplify queue/open/reload and availability branches with named
  predicates and guard clauses without changing authorization or errors.
- [ ] 2.3 Deduplicate criterion/annotation/save/conflict action handling only
  where scope, CAS, idempotency, and side effects are identical.
- [ ] 2.4 Simplify approval/return/release and projection branches while keeping
  teacher score authority, AI advisory state, completeness blockers, and
  partial feedback explicit.
- [ ] 2.5 Preserve Assignment API ownership, Assessment attempt semantics,
  Learning Record/evidence boundary, outbox, privacy, and recovery states.
- [ ] 2.6 Reject pure file splitting, speculative abstractions, or cosmetic
  edits as completion evidence.

## 3. Compare and verify

- [ ] 3.1 Run focused queue/workspace/console tests after each logical change.
- [ ] 3.2 Compare command payloads, lineage/auth errors, score totals, approval
  snapshots, partial release, outbox/evidence status, and accessibility.
- [ ] 3.3 Record after metrics and a before/after map for accepted, rejected,
  and deferred transformations.

## 4. Handoff

- [ ] 4.1 Run Assignment, Assessment, Learning Record boundary, route/UI,
  typecheck, lint, build, strict validation, and `git diff --check`.
- [ ] 4.2 Record residual UI/test gaps without changing lifecycle or governance
  contracts.
