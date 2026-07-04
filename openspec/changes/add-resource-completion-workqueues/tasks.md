## Tasks

- [x] Task 1: Add workqueue output contracts.
  Covers: AC-1, AC-2
  Acceptance: The helper emits typed queues for every major resource-completion batch.
  Evidence: unit tests for generated workqueue shape.
  Reviewer Check: Confirm queue records are stable and privacy minimized.

- [x] Task 2: Add reconciliation checks.
  Covers: AC-3
  Acceptance: Queue totals reconcile with helper totals and do not double-count resources across primary queues.
  Evidence: fixture-based reconciliation tests.
  Reviewer Check: Confirm every current uncovered blocker appears in exactly one primary queue or an explicit dependent queue.

- [x] Task 3: Validate OpenSpec and helper output.
  Covers: AC-1, AC-2, AC-3
  Acceptance: OpenSpec validation and targeted helper tests pass.
  Evidence: `rtk openspec validate add-resource-completion-workqueues --strict` plus targeted helper tests.
  Reviewer Check: Confirm no semantic field is auto-promoted by this change.

- [x] Task 4: Enforce human-confirmed integrity.
  Covers: AC-4
  Acceptance: Generated suggestions, placeholder reviewers, and missing rationale/source evidence cannot produce human-confirmed path eligibility.
  Evidence: targeted helper tests, regenerated diagnostics with `invalidHumanConfirmedRows === 0`, and independent data-governance review.
  Reviewer Check: Confirm stale or invalid review evidence is queued for human review instead of counted as governed completion.

## Validation

- [x] Run `rtk openspec validate add-resource-completion-workqueues --strict`.
- [x] Run the helper or targeted tests named in the task evidence.
- [x] Preserve before/after helper output for independent review.
