---
change_id: complete-learning-goal-checkpoint-question-sets
claim_branch: complete-learning-goal-checkpoint-question-sets
series: adaptive-assessment-item-bank
coupling_group: adaptive-assessment-item-bank
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - unify-adaptive-assessment-item-catalog
  - add-assessment-item-semantic-review-workflow
parent_issue:
blocked_by:
  - unify-adaptive-assessment-item-catalog
  - add-assessment-item-semantic-review-workflow
blocking:
  - wire-adaptive-engine-to-reviewed-item-catalog
openspec_path: openspec/changes/complete-learning-goal-checkpoint-question-sets
risk: high
area: assessment
---

## Goal

Complete minimum reviewed assessment item sets for every current path-ready LearningGoal so adaptive paths have real precheck, practice, checkpoint, and remediation questions.

## Scope

- Define minimum reviewed item coverage per LearningGoal and stage.
- Reuse suitable existing sources before authoring new items, including AC-Q static files and iCourse objective-bank items with repository-derived counts.
- Manually review semantic fields for every path-eligible item.
- Emit LearningGoal-by-stage coverage and limitations.
- Block high-confidence path/checkpoint claims when coverage is incomplete.

## Out of Scope

- Do not replace typed simulation, workbench, Arena, or project terminal-validation outcomes with quiz-only evidence.
- Do not switch runtime next-question selection to the catalog in this change.
- Do not mark generated or unreviewed items as reviewed by script.

## Acceptance Checklist

- [ ] AC-1: Minimum reviewed item counts are defined for every current path-ready LearningGoal and required assessment stage. Owner: independent reviewer.
  Evidence: policy config/spec and tests.
- [ ] AC-2: Existing question sources are reviewed and either reused, rejected, deprecated, blocked, or rewritten with audit evidence, including preset questions, Prisma `Question`, AC-Q static files, iCourse objective-bank items, and K/A/Q foundation artifacts. Owner: independent reviewer.
  Evidence: reviewed item snapshots and coverage matrix.
- [ ] AC-3: Every counted item has current human review audit and complete LearningGoal/K/A/Q/graph/stage/difficulty/cognitive/misconception/remediation fields. Owner: independent reviewer.
  Evidence: validator output and tests.
- [ ] AC-4: Coverage matrix reports each LearningGoal's stage coverage, source mix, blockers, and limitations. Owner: independent reviewer.
  Evidence: matrix artifact and tests.
- [ ] AC-5: Incomplete coverage blocks or limits high-confidence path/checkpoint claims. Owner: independent reviewer.
  Evidence: planner or coverage tests.
- [ ] AC-6: OpenSpec and targeted coverage validation pass. Owner: independent reviewer.
  Evidence: `rtk openspec validate complete-learning-goal-checkpoint-question-sets --strict` and targeted test command.

## Tasks

- [ ] Task 1: Define LearningGoal assessment coverage policy.
  Covers: AC-1, AC-5
  Acceptance: Required item counts and blocker behavior are codified for all current path-ready goals and stages.
  Evidence: policy config/spec and tests.
  Reviewer Check: Confirm the expected LearningGoal count comes from the registered catalog or explicit fixture.
- [ ] Task 2: Review and classify existing question sources.
  Covers: AC-2, AC-3
  Acceptance: Preset, Prisma `Question`, AC-Q static files, iCourse objective-bank items, K/A/Q foundation-bank, and generated sources are reused or rejected with audit trail.
  Evidence: reviewed snapshots and validation output.
  Reviewer Check: Confirm unsuitable items remain visible but not path-eligible.
- [ ] Task 3: Author or rewrite missing checkpoint items.
  Covers: AC-2, AC-3, AC-4
  Acceptance: Remaining LearningGoal/stage gaps are filled with reviewed items or explicit limitations.
  Evidence: coverage matrix and reviewed item snapshots.
  Reviewer Check: Confirm new or rewritten items are semantically coherent and not template placeholders.
- [ ] Task 4: Wire coverage matrix into planning limitations.
  Covers: AC-4, AC-5
  Acceptance: Planner diagnostics can consume coverage state and refuse high-confidence checkpoint claims when incomplete.
  Evidence: planner/coverage tests.
  Reviewer Check: Confirm generated or unreviewed items do not count toward minimum coverage.
- [ ] Task 5: Validate the change.
  Covers: AC-6
  Acceptance: OpenSpec validation and targeted coverage tests pass.
  Evidence: validation command output.
  Reviewer Check: Confirm evidence comes from the implementation branch.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
