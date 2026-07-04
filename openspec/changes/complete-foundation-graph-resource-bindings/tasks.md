## Tasks

- [ ] Task 1: Generate foundation graph binding worklist.
  Covers: AC-1
  Acceptance: Worklist is filtered to foundation goals and target graph nodes.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm no non-foundation domain is included.

- [ ] Task 2: Manually review and bind resources.
  Covers: AC-1, AC-2
  Acceptance: Each accepted binding has semantic rationale and correct disposition boundary.
  Evidence: data/source diff plus helper output.
  Reviewer Check: Confirm SAR/RAG suggestions were treated as candidates, not final truth.

- [ ] Task 3: Validate foundation LearningGoal coverage.
  Covers: AC-3
  Acceptance: Baseline matrix shows improved foundation concept coverage and no invalid path promotion.
  Evidence: baseline matrix and helper output.
  Reviewer Check: Confirm provisional metadata does not count as human-confirmed coverage.

## Validation

- [ ] Run `rtk openspec validate complete-foundation-graph-resource-bindings --strict`.
- [ ] Run the helper or targeted tests named in the task evidence.
- [ ] Preserve before/after helper output for independent review.
