## Tasks

- [x] Task 1: Generate citation/index worklist.
  Covers: AC-1, AC-3
  Acceptance: Worklist separates unmapped chunks, missing anchors, missing transcripts, and resolver limitations.
  Evidence: helper output.
  Reviewer Check: Confirm path eligibility is not inferred from indexability.

- [x] Task 2: Complete governed index and anchor metadata.
  Covers: AC-1, AC-2, AC-3
  Acceptance: Reviewed sources resolve through server-owned CitationAddress metadata or limitation state.
  Evidence: source diff and resolver tests.
  Reviewer Check: Confirm model-authored URLs are not trusted.

- [x] Task 3: Validate Konling/path citation coverage.
  Covers: AC-2
  Acceptance: Selected/supporting resources can be cited with clickable or limited citation chips.
  Evidence: targeted citation tests.
  Reviewer Check: Confirm privacy and authority scope are respected.

## Validation

- [x] Run `rtk openspec validate complete-rag-citation-anchor-coverage --strict`.
- [x] Run the helper or targeted tests named in the task evidence.
- [x] Preserve before/after helper output for independent review.
