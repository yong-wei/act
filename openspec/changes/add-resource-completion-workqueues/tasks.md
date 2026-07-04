## Tasks

- [ ] Task 1: Add workqueue output contracts.
  Covers: AC-1, AC-2
  Acceptance: The helper emits typed queues for every major resource-completion batch.
  Evidence: unit tests for generated workqueue shape.
  Reviewer Check: Confirm queue records are stable and privacy minimized.

- [ ] Task 2: Add reconciliation checks.
  Covers: AC-3
  Acceptance: Queue totals reconcile with helper totals and do not double-count resources across primary queues.
  Evidence: fixture-based reconciliation tests.
  Reviewer Check: Confirm every current uncovered blocker appears in exactly one primary queue or an explicit dependent queue.

- [ ] Task 3: Validate OpenSpec and helper output.
  Covers: AC-1, AC-2, AC-3
  Acceptance: OpenSpec validation and targeted helper tests pass.
  Evidence: `rtk openspec validate add-resource-completion-workqueues --strict` plus targeted helper tests.
  Reviewer Check: Confirm no semantic field is auto-promoted by this change.

## Validation

- [ ] Run `rtk openspec validate add-resource-completion-workqueues --strict`.
- [ ] Run the helper or targeted tests named in the task evidence.
- [ ] Preserve before/after helper output for independent review.
