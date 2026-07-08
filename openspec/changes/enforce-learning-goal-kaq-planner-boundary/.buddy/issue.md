---
change_id: enforce-learning-goal-kaq-planner-boundary
claim_branch: enforce-learning-goal-kaq-planner-boundary
series: resource-semantic-completion-closure
coupling_group: resource-planner-governance
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - align-path-planner-with-resource-center-registry
parent_issue: 876
blocked_by: []
blocking: []
openspec_path: openspec/changes/enforce-learning-goal-kaq-planner-boundary
risk: medium
area: adaptive-learning
---

## Goal

Ensure adaptive path generation uses LearningGoal K/A/Q objectives and graph targets as the canonical planning boundary instead of broad legacy compatibility fields.

## Scope

- Extract planner boundary metadata from LearningGoal K/A/Q objectives, graph targets, prerequisite subgraphs, and policy-required checkpoint/remediation roles.
- Exclude candidate resources that lack reviewed fit to the requested LearningGoal boundary.
- Add diagnostics for included and excluded objective matches.
- Test all backend-registered path-ready LearningGoals dynamically.

## Out of Scope

- Completing individual resource semantic fields.
- UI redesign for path comparison.
- Creating new LearningGoals.
- Changing learner-state personalization beyond resource boundary filtering.

## Acceptance Checklist

- [ ] AC-1: Planner extracts canonical K/A/Q and graph boundary metadata from LearningGoal records. Owner: independent reviewer.
  Evidence: focused LearningGoal/planner tests.
- [ ] AC-2: Candidate filtering excludes resources without reviewed LearningGoal, K/A/Q, graph, or policy-required checkpoint/remediation fit. Owner: independent reviewer.
  Evidence: root-locus and frequency-response regression tests.
- [ ] AC-3: Diagnostics expose accepted objective refs, rejected mismatch counts, selected-resource match evidence, and low-resource reasons. Owner: independent reviewer.
  Evidence: diagnostic payload tests.
- [ ] AC-4: Tests enumerate backend-registered LearningGoals dynamically and verify boundary behavior for every path-ready goal. Owner: independent reviewer.
  Evidence: all-goal planner diagnostic test output.
- [ ] AC-5: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate enforce-learning-goal-kaq-planner-boundary --strict` and issue-body validation pass.

## Tasks

- [ ] Task 1: Build LearningGoal K/A/Q boundary extraction for the planner.
  Covers: AC-1
  Acceptance: Planner input includes canonical objective, graph, prerequisite, checkpoint, and terminal-policy refs.
  Evidence: Focused LearningGoal/planner tests.
  Reviewer Check: Confirm legacy fields are compatibility signals only.
- [ ] Task 2: Enforce candidate filtering by reviewed objective or graph fit.
  Covers: AC-2
  Acceptance: Candidates without reviewed LearningGoal/K/A/Q/graph/policy-required fit are excluded.
  Evidence: Regression tests for root-locus and frequency-response goals.
  Reviewer Check: Confirm broad old competency fields cannot admit unrelated resources.
- [ ] Task 3: Add objective-boundary diagnostics.
  Covers: AC-3
  Acceptance: Diagnostics show included refs, rejected mismatch counts, selected match evidence, and low-resource reasons.
  Evidence: Diagnostic payload tests.
  Reviewer Check: Confirm diagnostics are privacy-safe.
- [ ] Task 4: Add all-LearningGoal boundary tests.
  Covers: AC-4
  Acceptance: The test enumerates registered path-ready LearningGoals dynamically and verifies boundary enforcement.
  Evidence: Focused test output.
  Reviewer Check: Confirm no hard-coded UI goal list is used.
- [ ] Task 5: Run validation and prepare review evidence.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, and focused tests pass.
  Evidence: Command output in implementation summary.
  Reviewer Check: Confirm all AC ids have evidence and no AC is self-approved.

## Agent Guardrails

- Only execute this issue's change.
- Do not complete individual resource semantics in this issue.
- Do not broaden candidate filtering to compensate for missing resource metadata; report low-resource limitation instead.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
