## 1. Understand and baseline

- [x] 1.1 Read student workspace callers, Assignment API DTOs, response/asset
  contracts, and history; enumerate all state and request paths.
- [x] 1.2 Capture before metrics: lines, components/functions, branches,
  duplicate request/state paths, imports, and representative UI/API behavior.
- [x] 1.3 Freeze tests for ownership, revision snapshots, draft save, assets,
  submit/resubmit, idempotency, history, feedback/result release, and a11y.

## 2. Apply code simplification

- [x] 2.1 Invoke the `code-simplification` skill with the frozen behavior,
  trust boundaries, target workspace, characterization tests, permitted
  deletion set, and explicit prohibition on adjacent refactoring.
- [x] 2.2 Simplify load/retry/conflict and local-draft preservation transitions
  with named predicates and guard clauses.
- [x] 2.3 Deduplicate attachment preflight/sign/finalize/read/remove/reorder
  handling only where scope and side effects are identical.
- [x] 2.4 Simplify question submit/resubmit/history/result branches while
  retaining distinct server-owned lifecycle states.
- [x] 2.5 Preserve frozen student ownership, Assignment API authority,
  Assessment attempts, Learning Record boundaries, and result privacy.
- [x] 2.6 Reject pure file splitting, speculative abstractions, or cosmetic
  edits as completion evidence.

## 3. Compare and verify

- [x] 3.1 Run direct workspace tests after each logical simplification.
- [x] 3.2 Compare request payloads, idempotency/conflict behavior, attachment
  integrity/order, attempt states, released fields, and focus behavior.
- [x] 3.3 Record after metrics and a before/after map for every transformation.

## 4. Handoff

- [x] 4.1 Run Assignment/Assessment/Learning Record boundary tests, route/UI
  suites, typecheck, lint, build, strict validation, and `git diff --check`.
- [x] 4.2 Document remaining state or accessibility gaps without changing the
  lifecycle contracts.
