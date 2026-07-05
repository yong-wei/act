## Tasks

- [ ] Task 1: Generate or shard runtime step worklist.
  Covers: AC-1
  Acceptance: Worklist groups runtime lesson steps by lesson, deterministic shard, and missing field codes.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm media and long-form resources are out of scope.

- [ ] Task 2: Review step PlanningUnit eligibility.
  Covers: AC-1, AC-2
  Acceptance: Eligible steps are promoted only with full required metadata.
  Evidence: ResourceNode audit output.
  Reviewer Check: Confirm route targets are real and evidence contracts are complete.

- [ ] Task 3: Classify non-planning runtime steps.
  Covers: AC-3
  Acceptance: Non-planning steps are linked or excluded with rationale.
  Evidence: disposition audit output.
  Reviewer Check: Confirm no orphan segment remains unexplained.

## Validation

- [ ] Run `rtk openspec validate review-runtime-lesson-planning-units --strict`.
- [ ] Run the helper or targeted tests named in the task evidence.
- [ ] Preserve before/after helper output for independent review.
