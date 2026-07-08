---
change_id: complete-runtime-lesson-media-resource-semantics
claim_branch: complete-runtime-lesson-media-resource-semantics
series: resource-semantic-completion-closure
coupling_group: resource-semantic-data
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - align-path-planner-with-resource-center-registry
parent_issue: 876
blocked_by: []
blocking: []
openspec_path: openspec/changes/complete-runtime-lesson-media-resource-semantics
risk: high
area: resource-governance
---

## Goal

Complete reviewed semantic metadata and dispositions for runtime lessons, lesson steps, modules, media, slides, audio/video, PDFs, and handouts so these resources can genuinely participate in path planning and citation flows.

## Scope

- Process runtime lesson step/module/media/slide/audio/video/PDF/handout workqueues.
- Review each item against runtime manifest, parent lesson, route target, source asset, graph context, LearningGoal K/A/Q objectives, path stage, evidence contract, and privacy/access policy.
- Promote only independently executable reviewed PlanningUnits.
- Link or classify non-independent fragments with reviewed support/exclusion rationale.

## Out of Scope

- Textbook/reference section or chunk review.
- Assessment item/checkpoint semantic review.
- Planner loader implementation beyond using existing contract.
- Bulk script-generated semantic completion.

## Acceptance Checklist

- [ ] AC-1: Scoped runtime workqueues are deterministic and include only runtime lesson/media/handout families with starting blocker counts. Owner: independent reviewer.
  Evidence: helper workqueue output.
- [ ] AC-2: Independently executable runtime PlanningUnits have reviewed path-planning metadata. Owner: independent reviewer.
  Evidence: metadata diff and ResourceNode audit.
- [ ] AC-3: Supporting runtime fragments and media are linked to parent PlanningUnits or classified with reviewed rationale and cannot become independent PathNodes. Owner: independent reviewer.
  Evidence: helper before/after output and parent-link checks.
- [ ] AC-4: Scoped runtime queues close with `remaining: 0` for unexplained unreviewed runtime items, and all-goal path diagnostics show reviewed runtime resource families available where they exist. Owner: independent reviewer.
  Evidence: final scoped helper summary plus planner diagnostic output.
- [ ] AC-5: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate complete-runtime-lesson-media-resource-semantics --strict` and issue-body validation pass.

## Tasks

- [ ] Task 1: Generate scoped runtime workqueues.
  Covers: AC-1
  Acceptance: Workqueues are limited to runtime lesson and media families and include starting blocker counts.
  Evidence: Helper output.
  Reviewer Check: Confirm no long-form or assessment family is included.
- [ ] Task 2: Review independent runtime PlanningUnits.
  Covers: AC-2
  Acceptance: Promoted items have reviewed launch, graph/K/A/Q, LearningGoal, path, evidence, privacy, readiness, citation, and review metadata.
  Evidence: Metadata diff and ResourceNode audit.
  Reviewer Check: Confirm each promoted item is independently executable.
- [ ] Task 3: Review supporting runtime fragments and media.
  Covers: AC-3
  Acceptance: Non-independent fragments are parent-linked or classified with reviewed rationale.
  Evidence: Helper before/after output and parent-link checks.
  Reviewer Check: Confirm no fragment is promoted because it merely contains content.
- [ ] Task 4: Validate LearningGoal resource mix impact.
  Covers: AC-4
  Acceptance: Scoped helper output reports `remaining: 0` for unexplained unreviewed runtime items, and path diagnostics show runtime resource families available for relevant goals or specific remaining blockers.
  Evidence: Final helper summary plus planner diagnostic output.
  Reviewer Check: Confirm resource diversity is materially improved where data exists and no item was skipped because semantic review was required.
- [ ] Task 5: Run validation and prepare review evidence.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, helper checks, and focused tests pass.
  Evidence: Command output.
  Reviewer Check: Confirm all AC ids have evidence and no AC is self-approved.

## Agent Guardrails

- Only execute this issue's change.
- Semantic review is an implementing-agent responsibility in this issue; do not mark `needs-human` merely because semantic judgment is required.
- Use helper scripts only for workqueue selection, gap measurement, and validation. Do not use scripts to infer accepted semantic labels.
- This issue must not block Yang Fan fixture data completion; fixture readiness remains scoped to fixture-owned governed resources.
- Stop only for concrete blockers: missing scoped workqueue, unstable denominator, inaccessible source artifact, schema conflict, dependency conflict, claim conflict, or PR/branch conflict.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
