---
change_id: unify-adaptive-assessment-item-catalog
claim_branch: unify-adaptive-assessment-item-catalog
series: adaptive-assessment-item-bank
coupling_group: adaptive-assessment-item-bank
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking:
  - add-assessment-item-semantic-review-workflow
  - complete-learning-goal-checkpoint-question-sets
  - wire-adaptive-engine-to-reviewed-item-catalog
openspec_path: openspec/changes/unify-adaptive-assessment-item-catalog
risk: medium
area: assessment
---

## Goal

Create the governed adaptive-assessment item catalog that unifies current question sources and makes path eligibility explicit.

## Scope

- Register current adaptive question source families in one catalog, including 50 preset questions, Prisma `Question`, AC-Q static files, iCourse objective-bank items, generated questions, K/A/Q foundation artifacts, and future checkpoint items.
- Preserve source lineage, content hash, review state, and eligibility state.
- Define the relationship between catalog truth and immutable `AdaptiveAssessmentItemRef` snapshots.
- Emit deterministic catalog and limitation artifacts.

## Out of Scope

- Do not manually review every question's semantic fields in this change.
- Do not switch `/api/assessment/next-question` selection to the new catalog in this change.
- Do not create new LearningGoal checkpoint item sets in this change.

## Acceptance Checklist

- [ ] AC-1: All current assessment item source families are represented with source totals and limitation reasons, including 50 preset questions, Prisma `Question`, current AC-Q file count, current iCourse objective-bank index count, generated questions, K/A/Q foundation artifacts, and future checkpoint items. Owner: independent reviewer.
  Evidence: catalog artifact output and source-count tests.
- [ ] AC-2: Catalog item identity includes source lineage, immutable content hash, review state, eligibility state, and version refs. Owner: independent reviewer.
  Evidence: catalog schema/types and tests.
- [ ] AC-3: `AdaptiveAssessmentItemRef` remains an immutable answer-time snapshot and is not treated as the mutable catalog truth. Owner: independent reviewer.
  Evidence: persistence tests or implementation review.
- [ ] AC-4: Only explicitly `path-eligible` items may support readiness, checkpoint, remediation gate, or terminal-validation evidence. Owner: independent reviewer.
  Evidence: eligibility tests.
- [ ] AC-5: OpenSpec and targeted catalog validation pass. Owner: independent reviewer.
  Evidence: `rtk openspec validate unify-adaptive-assessment-item-catalog --strict` and targeted test command.

## Tasks

- [ ] Task 1: Define the catalog item contract.
  Covers: AC-2, AC-3, AC-4
  Acceptance: Item identity, lineage, hash, review state, eligibility state, and snapshot relationship are codified.
  Evidence: spec delta, schema/types, and tests.
  Reviewer Check: Confirm historical answer snapshots cannot be rewritten by catalog edits.
- [ ] Task 2: Register current source families.
  Covers: AC-1
  Acceptance: Preset questions, Prisma `Question`, AC-Q static files, iCourse objective-bank items, K/A/Q foundation-bank items, generated questions, and future checkpoint source families are represented or reported as blocked.
  Evidence: catalog artifact output and source-count tests.
  Reviewer Check: Confirm incomplete sources are visible instead of silently omitted.
- [ ] Task 3: Implement eligibility and limitation reporting.
  Covers: AC-1, AC-4
  Acceptance: Catalog artifacts distinguish registered, unreviewed, provisional, reviewed, path-eligible, and deprecated states.
  Evidence: limitation artifact and tests.
  Reviewer Check: Confirm provisional items cannot satisfy readiness or checkpoint gates.
- [ ] Task 4: Validate the change.
  Covers: AC-5
  Acceptance: OpenSpec validation and targeted catalog tests pass.
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
