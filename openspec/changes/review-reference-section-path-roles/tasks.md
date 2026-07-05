## Tasks

- [x] Task 1: Generate reference section worklist.
  Covers: AC-1
  Acceptance: Worklist targets reference and encyclopedia sections not covered by core textbook review.
  Evidence: helper output.
  Reviewer Check: Confirm core textbook records are excluded.

- [x] Task 2: Review reference roles item by item.
  Covers: AC-1, AC-2
  Acceptance: Accepted references include role, graph fit, and source authority rationale.
  Evidence: source diff and helper output.
  Reviewer Check: Confirm advanced/enrichment role is not confused with required path coverage.

- [x] Task 3: Validate exclusions and limitations.
  Covers: AC-3
  Acceptance: Rejected or unsuitable sections have reviewed rationale and no unexplained gaps remain for this batch.
  Evidence: helper disposition output.
  Reviewer Check: Confirm copyright or scope limitations are visible.

## Validation

- [x] Run `rtk openspec validate review-reference-section-path-roles --strict`.
- [x] Run the helper or targeted tests named in the task evidence.
- [x] Preserve before/after helper output for independent review.
