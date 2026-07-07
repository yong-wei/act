---
change_id: fix-adaptive-path-graph-typecheck-debt
claim_branch: fix-adaptive-path-graph-typecheck-debt
series: release-signal-noise-elimination
coupling_group: none
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/fix-adaptive-path-graph-typecheck-debt
risk: medium
area: adaptive-learning
---

## Goal

Eliminate the adaptive path/graph TypeScript no-emit cluster: 10 current errors in path planner, control-correction path round, learner-state, and assessment coverage tests.

## Scope

- `src/features/adaptive-assessment/__tests__/learning-goal-assessment-coverage.test.ts`
- `src/lib/__tests__/adaptive-learner-state-service.test.ts`
- `src/lib/__tests__/adaptive-learning-path-planner.test.ts`
- `src/lib/__tests__/control-correction-path-rounds.test.ts`

## Out of Scope

- Do not change path ranking or planner resource selection.
- Do not change low-resource fallback policy.
- Do not address unrelated tsc clusters.

## Acceptance Checklist

- [ ] AC-1: The adaptive path/graph cluster reports zero TypeScript errors. Owner: independent reviewer.
  Evidence: filtered `rtk npx tsc --noEmit --pretty false` output for scoped files.
- [ ] AC-2: Fixtures match current graph coverage, capability target, LearningGoal, and path context contracts. Owner: independent reviewer.
  Evidence: focused tests and reviewer source inspection.
- [ ] AC-3: Full typecheck is rerun and remaining errors are outside this scope. Owner: independent reviewer.
  Evidence: full `rtk npx tsc --noEmit --pretty false` output.

## Tasks

- [ ] Task 1: Reproduce scoped TypeScript errors.
  Covers: AC-1
  Acceptance: Current errors for the scoped files are listed before changes.
  Evidence: baseline tsc output.
  Reviewer Check: Confirm the scoped file list matches this issue.
- [ ] Task 2: Align graph coverage and path context fixtures.
  Covers: AC-1, AC-2
  Acceptance: Coverage route ids, filter refs, selected graph nodes, resource ids, and path context fields match current contracts.
  Evidence: diff and focused tests.
  Reviewer Check: Confirm planner behavior is not changed.
- [ ] Task 3: Align LearningGoal and learner-state fixtures.
  Covers: AC-1, AC-2
  Acceptance: Capability targets, goal policies, assessment domain values, and nullability match current contracts.
  Evidence: diff and focused tests.
  Reviewer Check: Confirm low-resource states remain visible where intended.
- [ ] Task 4: Validate typecheck signal.
  Covers: AC-1, AC-3
  Acceptance: Scoped errors are gone and full typecheck remaining errors are outside scope.
  Evidence: full tsc output.
  Reviewer Check: Confirm no unrelated cluster was modified.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Keep edits scoped to listed tests unless a directly imported test helper needs a minimal update.
- Do not use `as any`, broad `unknown` casts, or type suppression to hide real contract drift.
- Do not execute other planned OpenSpec changes.
