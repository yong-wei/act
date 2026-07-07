---
change_id: add-assessment-item-semantic-review-workflow
claim_branch: add-assessment-item-semantic-review-workflow
series: adaptive-assessment-item-bank
coupling_group: adaptive-assessment-item-bank
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - unify-adaptive-assessment-item-catalog
parent_issue:
blocked_by:
  - unify-adaptive-assessment-item-catalog
blocking:
  - complete-learning-goal-checkpoint-question-sets
  - wire-adaptive-engine-to-reviewed-item-catalog
openspec_path: openspec/changes/add-assessment-item-semantic-review-workflow
risk: medium
area: assessment
---

## Goal

Add a human semantic review workflow for cataloged assessment items so only reviewed items can become path-eligible.

## Scope

- Define review packets and reviewer decision records.
- Require LearningGoal, K/A/Q, graph, stage, difficulty, cognitive level, misconception, remediation, and audit fields for path eligibility.
- Add validators and data-quality gates for stale, missing, invalid, and unreviewed item semantics.
- Report coverage across all catalog source families, including AC-Q static files and iCourse objective-bank items with repository-derived counts.

## Out of Scope

- Do not complete the full manual review backlog in this change.
- Do not switch adaptive next-question selection to the reviewed catalog in this change.
- Do not create new minimum checkpoint item sets in this change.

## Acceptance Checklist

- [ ] AC-1: Review packets expose enough item context and candidate semantics for human review. Owner: independent reviewer.
  Evidence: packet schema/output and tests.
- [ ] AC-2: A human review decision is required before `semantically-reviewed` or `path-eligible` can be set. Owner: independent reviewer.
  Evidence: validator tests rejecting script-only review.
- [ ] AC-3: Required semantic fields cover LearningGoal, K/A/Q objectives, graph nodes, stage, difficulty, cognitive level, misconceptions, remediation, and audit refs. Owner: independent reviewer.
  Evidence: schema/types and missing-field tests.
- [ ] AC-4: Coverage reports include all registered source families, repository-derived AC-Q/iCourse counts, and stale/rejected/deprecated states. Owner: independent reviewer.
  Evidence: coverage report fixture and tests.
- [ ] AC-5: OpenSpec and targeted semantic review validation pass. Owner: independent reviewer.
  Evidence: `rtk openspec validate add-assessment-item-semantic-review-workflow --strict` and targeted test command.

## Tasks

- [ ] Task 1: Define review packet and review decision contracts.
  Covers: AC-1, AC-3
  Acceptance: Packet and decision records carry all required semantic and audit fields.
  Evidence: schema/types and fixtures.
  Reviewer Check: Confirm reviewers can judge semantics without hidden repository assumptions.
- [ ] Task 2: Enforce manual review before eligibility.
  Covers: AC-2
  Acceptance: Script/model suggestions cannot set reviewed or path-eligible state without reviewer audit.
  Evidence: negative tests.
  Reviewer Check: Confirm automated inference is stored only as suggestion.
- [ ] Task 3: Add semantic coverage validation.
  Covers: AC-3, AC-4
  Acceptance: Validator reports missing fields, stale source hashes, invalid ids, rejected/deprecated states, and source-family totals including AC-Q and iCourse objective-bank counts.
  Evidence: coverage report and tests.
  Reviewer Check: Confirm all catalog source families appear in output.
- [ ] Task 4: Validate the change.
  Covers: AC-5
  Acceptance: OpenSpec validation and targeted semantic workflow tests pass.
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
