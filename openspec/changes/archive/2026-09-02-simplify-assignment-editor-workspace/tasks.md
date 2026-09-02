## 1. Understand and baseline

- [x] 1.1 Read editor callers, public API commands, adjacent UI contracts, and
  history; enumerate draft, question, rubric, asset, validation, save,
  conflict, publication, and AI states.
- [x] 1.2 Capture before metrics: lines, components/functions, branches,
  duplicate paths, state transitions, imports, and representative UI/API
  behavior.
- [x] 1.3 Freeze tests for draft/published revisions, CAS/idempotency,
  question/rubric/assets, validation, audience, AI approval, and accessibility.

## 2. Apply code simplification

- [x] 2.1 Invoke the `code-simplification` skill with the frozen behavior,
  trust boundaries, target workspace, characterization tests, permitted
  deletion set, and explicit prohibition on adjacent refactoring.
- [x] 2.2 Simplify load/save/conflict/error transitions with named predicates and
  guard clauses while preserving ordering and recovery.
- [x] 2.3 Deduplicate question, rubric, asset, and validation updates only when
  request scope, side effects, and error behavior are identical.
- [x] 2.4 Make publication and AI-draft approval branches explicit; do not
  collapse draft, stale, published, or approved states.
- [x] 2.5 Preserve Assignment API ownership, immutable snapshots, teacher
  authorization, and server-derived audience scope.
- [x] 2.6 Reject pure file splitting, speculative abstractions, or formatter-
  only edits as completion evidence.

## 3. Compare and verify

- [x] 3.1 Run focused editor and UI-contract tests after each logical change.
- [x] 3.2 Compare serialized command payloads, idempotency/CAS errors, rendered
  states, focus behavior, and teacher approval markers before and after.
- [x] 3.3 Record after metrics and a before/after mapping for each accepted,
  rejected, or deferred transformation.

## 4. Handoff

- [x] 4.1 Run Assignment domain/UI, route, typecheck, lint, build, strict
  validation, and `git diff --check`.
- [x] 4.2 Record remaining UI test gaps and hand off the simplified workspace
  without changing lifecycle or governance contracts.
