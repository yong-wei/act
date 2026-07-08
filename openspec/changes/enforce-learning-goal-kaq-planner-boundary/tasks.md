## Tasks

- [ ] Task 1: Build LearningGoal K/A/Q boundary extraction for the planner.
  Covers: AC-1
  Acceptance: Planner input includes canonical K/A/Q objective ids, graph node ids, expanded subgraph refs, and policy-required checkpoint/remediation refs.
  Evidence: Focused LearningGoal/planner tests.
  Reviewer Check: Confirm legacy compatibility fields are not the canonical boundary.

- [ ] Task 2: Enforce candidate filtering by reviewed objective or graph fit.
  Covers: AC-1, AC-2
  Acceptance: A candidate ResourceNode without reviewed LearningGoal, K/A/Q objective, graph-node, or policy-required checkpoint fit is excluded from graph-driven path generation.
  Evidence: Planner regression tests for root-locus and frequency-response goals.
  Reviewer Check: Confirm unrelated high-scoring resources cannot enter through old competency fields alone.

- [ ] Task 3: Add objective-boundary diagnostics.
  Covers: AC-3
  Acceptance: Diagnostics show accepted boundary refs, rejected mismatch counts, low-resource reasons, and selected-resource objective match evidence.
  Evidence: Diagnostic payload tests.
  Reviewer Check: Confirm diagnostics remain privacy-safe and student UI receives only allowed limitation text.

- [ ] Task 4: Validate all registered LearningGoals.
  Covers: AC-4
  Acceptance: Tests enumerate the backend LearningGoal catalog dynamically and verify boundary behavior for every path-ready goal.
  Evidence: All-goal planner diagnostic test output.
  Reviewer Check: Confirm the test is not hard-coded to a two-goal or nine-goal UI list.

- [ ] Task 5: Run OpenSpec and Buddy validation.
  Covers: AC-5
  Acceptance: OpenSpec validation and issue-body validation pass.
  Evidence: Validation command output.
  Reviewer Check: Confirm all AC ids have implementation evidence.

## Validation

- [ ] Run `rtk openspec validate enforce-learning-goal-kaq-planner-boundary --strict`.
- [ ] Run focused all-LearningGoal planner diagnostics and candidate-boundary tests.
- [ ] Run issue-body validation before GitHub issue creation.
