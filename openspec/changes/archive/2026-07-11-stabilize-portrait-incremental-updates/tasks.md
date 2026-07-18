## Tasks

- [x] Task 1: Implement portrait v2 incremental update engine.
  Covers: AC-1, AC-2
  Acceptance: The engine accepts previous portrait state plus evidence delta and returns a seven-dimensional portrait v2 state without overwriting untouched dimensions.
  Evidence: Focused unit tests.
  Reviewer Check: Confirm the algorithm separates score, confidence, freshness, and trend.

- [x] Task 2: Update the student snapshot worker to use incremental semantics.
  Covers: AC-2, AC-3
  Acceptance: Hourly worker runs preserve existing dimension scores when there is no relevant new evidence for those dimensions.
  Evidence: Worker regression tests.
  Reviewer Check: Confirm fixed 30-day recalculation no longer acts as the authoritative overwrite path.

- [x] Task 3: Add regression coverage for sparse and stale evidence.
  Covers: AC-3, AC-4
  Acceptance: Yang Fan-style fixture facts, path selection facts with empty contributions, and evidence aging do not collapse unrelated dimensions to zero.
  Evidence: Regression test output.
  Reviewer Check: Confirm stale evidence affects freshness/confidence, not raw score erasure.

- [x] Task 4: Run validation.
  Covers: AC-5
  Acceptance: OpenSpec validation and issue-body validation pass.
  Evidence: Validation command output.
  Reviewer Check: Confirm all AC ids map to implementation evidence.

## Validation

- [x] Run `rtk openspec validate stabilize-portrait-incremental-updates --strict`.
- [x] Run focused data-governance worker and portrait update tests.
- [x] Run Buddy issue-body validation before GitHub issue creation.
