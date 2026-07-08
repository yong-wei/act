---
change_id: fix-konling-context-typecheck-debt
claim_branch: fix-konling-context-typecheck-debt
series: release-signal-noise-elimination
coupling_group: none
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/fix-konling-context-typecheck-debt
risk: medium
area: ai
---

## Goal

Eliminate the Konling TypeScript no-emit cluster: 21 current errors in Konling runtime and teaching-assistant server-context tests.

## Scope

- `src/lib/__tests__/konling-agent-runtime.test.ts`
- `src/lib/__tests__/konling-teaching-assistant-server-context.test.ts`

## Out of Scope

- Do not change model provider configuration.
- Do not change prompt policy or citation verification behavior except for a proven type-contract bug.
- Do not address unrelated tsc clusters.

## Acceptance Checklist

- [ ] AC-1: The Konling cluster reports zero TypeScript errors. Owner: independent reviewer.
  Evidence: filtered `rtk npx tsc --noEmit --pretty false` output for scoped files.
- [ ] AC-2: Tool-result assertions and learner-state fixtures remain contract-valid without broad casts. Owner: independent reviewer.
  Evidence: diff and focused test output.
- [ ] AC-3: Full typecheck is rerun and remaining errors are outside this scope. Owner: independent reviewer.
  Evidence: full `rtk npx tsc --noEmit --pretty false` output.

## Tasks

- [ ] Task 1: Reproduce scoped TypeScript errors.
  Covers: AC-1
  Acceptance: Current errors for the scoped files are listed before changes.
  Evidence: baseline tsc output.
  Reviewer Check: Confirm the scoped file list matches this issue.
- [ ] Task 2: Type Konling tool-result assertions narrowly.
  Covers: AC-1, AC-2
  Acceptance: `unknown` tool outputs are narrowed through local helpers or existing contracts.
  Evidence: diff and focused tests.
  Reviewer Check: Confirm no broad casts hide invalid outputs.
- [ ] Task 3: Refresh context and learner-state fixtures.
  Covers: AC-1, AC-2
  Acceptance: Context keys, page types, knowledge types, terminal policy, and learner-state fixtures match current contracts.
  Evidence: diff and focused tests.
  Reviewer Check: Confirm personalization and citation semantics are preserved.
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
- Keep edits scoped to listed Konling tests unless a directly imported test helper needs a minimal update.
- Do not use `as any`, broad `unknown` casts, or type suppression to hide real contract drift.
- Do not execute other planned OpenSpec changes.
