## Tasks

- [x] Task 1: Generate or shard runtime step worklist.
  Covers: AC-1
  Acceptance: Worklist groups runtime lesson steps by lesson, deterministic shard, and missing field codes.
  Evidence: `course-content/runtime/resource-governance/runtime-lesson-planning-unit-workqueue-items.jsonl` and `runtime-lesson-planning-unit-workqueue-summary.json`.
  Reviewer Check: Confirm media and long-form resources are out of scope.

- [x] Task 2: Review step PlanningUnit eligibility.
  Covers: AC-1, AC-2
  Acceptance: Eligible steps in the selected queue/shard are promoted only with full required metadata.
  Evidence: `course-content/runtime/resource-governance/runtime-lesson-planning-unit-review-items.jsonl` and `runtime-lesson-planning-unit-review-evidence.md`.
  Reviewer Check: Confirm route targets are real and evidence contracts are complete.

- [x] Task 3: Classify non-planning runtime steps.
  Covers: AC-3
  Acceptance: Non-planning steps in the selected queue/shard are linked or excluded with rationale, and unselected shards remain in the workqueue or downstream handoff.
  Evidence: `course-content/runtime/resource-governance/runtime-lesson-planning-unit-review-items.jsonl` and `runtime-lesson-planning-unit-review-evidence.md`.
  Reviewer Check: Confirm no orphan segment remains unexplained.

## Validation

- [x] Run `rtk openspec validate review-runtime-lesson-planning-units --strict`.
- [x] Run the helper or targeted tests named in the task evidence.
- [x] Preserve before/after helper output for independent review.
