---
change_id: fix-interactive-ui-fixture-typecheck-debt
claim_branch: fix-interactive-ui-fixture-typecheck-debt
series: release-signal-noise-elimination
coupling_group: none
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/fix-interactive-ui-fixture-typecheck-debt
risk: medium
area: interactive
---

## Goal

Eliminate the interactive/UI TypeScript no-emit cluster: 11 current errors in interactive runtime, classroom lifecycle, assessment route-state, tracking, and AppShell governance tests.

## Scope

- `src/features/assessment/__tests__/document-rubric-grading-route-state.test.ts`
- `src/features/classroom/__tests__/classroom-lifecycle-dialog.test.ts`
- `src/features/interactive/__tests__/interactive-module-registry-gate.test.ts`
- `src/features/interactive/__tests__/interactive-tracking.test.tsx`
- `tests/appshell-governance-representative-matrix.spec.ts`

## Out of Scope

- Do not redesign UI behavior.
- Do not migrate shells or navigation.
- Do not address unrelated tsc clusters.

## Acceptance Checklist

- [ ] AC-1: The interactive/UI cluster reports zero TypeScript errors. Owner: independent reviewer.
  Evidence: filtered `rtk npx tsc --noEmit --pretty false` output for scoped files.
- [ ] AC-2: Test fixtures remain valid representations of current UI/component contracts. Owner: independent reviewer.
  Evidence: focused tests and reviewer source inspection.
- [ ] AC-3: Full typecheck is rerun and remaining errors are outside this scope. Owner: independent reviewer.
  Evidence: full `rtk npx tsc --noEmit --pretty false` output.

## Tasks

- [ ] Task 1: Reproduce scoped TypeScript errors.
  Covers: AC-1
  Acceptance: Current errors for the scoped files are listed before changes.
  Evidence: baseline tsc output.
  Reviewer Check: Confirm the scoped file list matches this issue.
- [ ] Task 2: Align interactive manifest fixtures.
  Covers: AC-1, AC-2
  Acceptance: Options and teacher controls use current manifest contracts.
  Evidence: diff and focused tests.
  Reviewer Check: Confirm invalid fixture fields are not preserved through casts.
- [ ] Task 3: Type UI test shims and mocks.
  Covers: AC-1, AC-2
  Acceptance: DOM shims, route-state mocks, tracking mocks, and role literals are narrowly typed.
  Evidence: diff and focused tests.
  Reviewer Check: Confirm product behavior is unchanged.
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
