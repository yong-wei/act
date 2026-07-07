## Tasks

- [x] Task 1: Generate residual backlog worklist.
  Covers: AC-1
  Acceptance: Helper output isolates only leftovers after upstream batches.
  Evidence: helper output.
  Reviewer Check: Confirm upstream family queues have been completed or explicitly excluded.

- [x] Task 2: Review residual resources item by item.
  Covers: AC-1, AC-2
  Acceptance: Every residual resource gets reviewed disposition or limitation.
  Evidence: source diff and helper output.
  Reviewer Check: Confirm no semantic field is script-filled without review.

- [x] Task 3: Produce downstream readiness summary.
  Covers: AC-3
  Acceptance: Evidence-lineage and final-gate issues receive summarized helper evidence.
  Evidence: helper summary file or verification notes.
  Reviewer Check: Confirm remaining blockers are outside semantic resource disposition scope.

## Validation

- [x] Run `rtk openspec validate close-resource-disposition-review-backlog --strict`.
- [x] Run the helper or targeted tests named in the task evidence.
- [x] Preserve before/after helper output for independent review.
