## Tasks

- [ ] Task 1: Replace partial path-generation registry loading with the unified ResourceNode registry projection.
  Covers: AC-1, AC-2
  Acceptance: Production path-generation entrypoints load registered resources, runtime projections, runtime lessons, media/handout dispositions, textbook/reference sections, and checkpoint contracts through a common governed loader.
  Evidence: Unit tests and implementation diff in planner/resource registry loading code.
  Reviewer Check: Confirm no entrypoint silently falls back to the older partial candidate loader.

- [ ] Task 2: Add candidate-pool diagnostics.
  Covers: AC-2
  Acceptance: Path diagnostics include registry version, projection version, candidate counts by family, excluded counts, and missing-source reasons.
  Evidence: Focused tests for diagnostic payload shape.
  Reviewer Check: Confirm diagnostics are privacy-safe and useful for later resource-completion agents.

- [ ] Task 3: Preserve PlanningUnit boundaries.
  Covers: AC-3
  Acceptance: Retrieval chunks, search documents, figures, captions, and other citation-only rows cannot become PathNodes without a reviewed ResourceNode or checkpoint contract.
  Evidence: Regression tests for high-ranking chunk/search-document candidates.
  Reviewer Check: Confirm ranking signals do not bypass ResourceNode path eligibility.

- [ ] Task 4: Validate OpenSpec and planner tests.
  Covers: AC-4
  Acceptance: OpenSpec validation, issue-body validation, and focused planner/resource registry tests pass.
  Evidence: `rtk openspec validate align-path-planner-with-resource-center-registry --strict` plus targeted test output.
  Reviewer Check: Confirm evidence maps to all AC ids.

## Validation

- [ ] Run `rtk openspec validate align-path-planner-with-resource-center-registry --strict`.
- [ ] Run focused path planner and ResourceNode registry tests.
- [ ] Run issue-body validation before GitHub issue creation.
