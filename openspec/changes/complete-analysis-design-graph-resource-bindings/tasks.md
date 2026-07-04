## Tasks

- [ ] Task 1: Generate analysis/design binding worklist.
  Covers: AC-1
  Acceptance: Worklist covers stability, steady-state, root-locus, frequency-response, margin, and correction-design nodes.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm foundation and simulation-transfer-only items are excluded.

- [ ] Task 2: Manually review and bind analysis/design resources.
  Covers: AC-1, AC-2
  Acceptance: Accepted bindings have rationale, role, and version evidence.
  Evidence: source diff and helper output.
  Reviewer Check: Confirm role labels are not inferred only from titles.

- [ ] Task 3: Validate affected LearningGoal baseline coverage.
  Covers: AC-2, AC-3
  Acceptance: Baseline limitations shrink or become actionable for analysis/design goals.
  Evidence: baseline matrix and limitations diff.
  Reviewer Check: Confirm no unreviewed item is promoted to checkpoint or terminal validation.

## Validation

- [ ] Run `rtk openspec validate complete-analysis-design-graph-resource-bindings --strict`.
- [ ] Run the helper or targeted tests named in the task evidence.
- [ ] Preserve before/after helper output for independent review.
