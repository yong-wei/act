---
change_id: fix-arena-evidence-typecheck-debt
claim_branch: fix-arena-evidence-typecheck-debt
series: release-signal-noise-elimination
coupling_group: none
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/fix-arena-evidence-typecheck-debt
risk: medium
area: arena
---

## Goal

Eliminate the Arena TypeScript no-emit cluster: 6 current errors in evidence writeback persistence and leaderboard tests.

## Scope

- `src/features/arena/__tests__/arena-evidence-writeback-persistence.test.ts`
- `src/features/arena/__tests__/arena-leaderboard.test.ts`

## Out of Scope

- Do not change official Arena score, validity, ranking, or leaderboard semantics.
- Do not alter Arena evaluation algorithms.
- Do not address unrelated tsc clusters.

## Acceptance Checklist

- [ ] AC-1: The Arena cluster reports zero TypeScript errors. Owner: independent reviewer.
  Evidence: filtered `rtk npx tsc --noEmit --pretty false` output for scoped files.
- [ ] AC-2: Arena official evaluation authority is preserved. Owner: independent reviewer.
  Evidence: focused tests and reviewer source inspection.
- [ ] AC-3: Full typecheck is rerun and remaining errors are outside this scope. Owner: independent reviewer.
  Evidence: full `rtk npx tsc --noEmit --pretty false` output.

## Tasks

- [ ] Task 1: Reproduce scoped TypeScript errors.
  Covers: AC-1
  Acceptance: Current errors for the scoped files are listed before changes.
  Evidence: baseline tsc output.
  Reviewer Check: Confirm the scoped file list matches this issue.
- [ ] Task 2: Repair evidence writeback mock typing.
  Covers: AC-1, AC-2
  Acceptance: Mocked payload typing no longer infers `never` and still checks intended payload shape.
  Evidence: diff and focused tests.
  Reviewer Check: Confirm evidence payload assertions are not weakened.
- [ ] Task 3: Align leaderboard submission fixtures.
  Covers: AC-1, AC-2
  Acceptance: Submission input fixtures match current `CreateArenaSubmissionInput`.
  Evidence: diff and focused tests.
  Reviewer Check: Confirm official scoring semantics are untouched.
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
- Preserve Arena official scoring and ranking authority.
- Do not execute other planned OpenSpec changes.
