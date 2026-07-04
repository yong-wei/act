## Tasks

- [ ] Task 1: Generate LearningGoal assessment worklists.
  Covers: AC-1
  Acceptance: Worklists show missing stages and candidate existing items per LearningGoal.
  Evidence: coverage matrix output.
  Reviewer Check: Confirm all 9 goals are enumerated dynamically.

- [ ] Task 2: Manually review and classify existing items.
  Covers: AC-1, AC-3
  Acceptance: Existing suitable items become reviewed/path-eligible for specific stages.
  Evidence: semantic review output.
  Reviewer Check: Confirm broad or ambiguous items are not counted.

- [ ] Task 3: Author minimal new checkpoint/remediation/terminal-validation where required items where needed.
  Covers: AC-1, AC-2, AC-3
  Acceptance: Only verified gaps receive new reviewed items with full semantics.
  Evidence: source diff and coverage output.
  Reviewer Check: Confirm new items align with graph and capability targets.

- [ ] Task 4: Validate assessment baseline completeness.
  Covers: AC-1, AC-2, AC-3
  Acceptance: OpenSpec and targeted coverage tests pass.
  Evidence: `rtk openspec validate complete-learning-goal-assessment-baselines --strict` plus assessment coverage tests.
  Reviewer Check: Confirm runtime selection is not implemented here.

## Validation

- [ ] Run `rtk openspec validate complete-learning-goal-assessment-baselines --strict`.
- [ ] Run the helper or targeted tests named in the task evidence.
- [ ] Preserve before/after helper output for independent review.
