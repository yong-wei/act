---
change_id: fix-sar-teacher-evidence-typecheck-debt
claim_branch: fix-sar-teacher-evidence-typecheck-debt
series: release-signal-noise-elimination
coupling_group: none
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/fix-sar-teacher-evidence-typecheck-debt
risk: medium
area: data-governance
---

## Goal

Eliminate the SAR/teacher evidence TypeScript no-emit cluster: 8 current errors in SAR persistence and teacher KAQ evidence trace tests.

## Scope

- `src/lib/data-governance/__tests__/sar-persistence.test.ts`
- `src/lib/data-governance/__tests__/teacher-kaq-evidence-trace.test.ts`

## Out of Scope

- Do not loosen privacy, retention, or source authority boundaries.
- Do not alter Arena official scoring semantics.
- Do not address unrelated tsc clusters.

## Acceptance Checklist

- [ ] AC-1: The SAR/teacher evidence cluster reports zero TypeScript errors. Owner: independent reviewer.
  Evidence: filtered `rtk npx tsc --noEmit --pretty false` output for scoped files.
- [ ] AC-2: Data-governance privacy and evidence authority boundaries are preserved. Owner: independent reviewer.
  Evidence: focused tests and reviewer source inspection.
- [ ] AC-3: Full typecheck is rerun and remaining errors are outside this scope. Owner: independent reviewer.
  Evidence: full `rtk npx tsc --noEmit --pretty false` output.

## Tasks

- [ ] Task 1: Reproduce scoped TypeScript errors.
  Covers: AC-1
  Acceptance: Current errors for the scoped files are listed before changes.
  Evidence: baseline tsc output.
  Reviewer Check: Confirm the scoped file list matches this issue.
- [ ] Task 2: Align SAR persisted-record fixtures.
  Covers: AC-1, AC-2
  Acceptance: Entity, event, relation, and query trace records use current typed contracts.
  Evidence: diff and focused tests.
  Reviewer Check: Confirm invalid records are not hidden through casts.
- [ ] Task 3: Align teacher evidence fixtures.
  Covers: AC-1, AC-2
  Acceptance: Learner-state, corpus family/source, and citation address fixtures match current contracts.
  Evidence: diff and focused tests.
  Reviewer Check: Confirm privacy and source authority boundaries remain intact.
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
