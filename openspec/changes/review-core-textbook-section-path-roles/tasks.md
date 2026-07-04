## Tasks

- [ ] Task 1: Generate core textbook section worklist.
  Covers: AC-1
  Acceptance: Worklist targets core textbook sections and excludes reference-only sources.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm chunk-level records are not primary path candidates.

- [ ] Task 2: Manually review section path roles.
  Covers: AC-1, AC-2
  Acceptance: Sections are assigned path/support/remediation/exclusion roles with rationale.
  Evidence: source diff and helper output.
  Reviewer Check: Confirm graph/LearningGoal mapping is semantically valid.

- [ ] Task 3: Validate section/chunk boundary.
  Covers: AC-3
  Acceptance: Chunks and figures cite through parent sections unless separately reviewed.
  Evidence: helper and RAG output.
  Reviewer Check: Confirm no raw chunk becomes a PathNode.

## Validation

- [ ] Run `rtk openspec validate review-core-textbook-section-path-roles --strict`.
- [ ] Run the helper or targeted tests named in the task evidence.
- [ ] Preserve before/after helper output for independent review.
