---
change_id: fix-resource-governance-typecheck-debt
claim_branch: fix-resource-governance-typecheck-debt
series: release-signal-noise-elimination
coupling_group: none
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/fix-resource-governance-typecheck-debt
risk: medium
area: quality-gates
---

## Goal

Eliminate the resource-governance TypeScript no-emit cluster: 29 current errors across the resource field-completion audit helper, resource audit tests, textbook/media grounding tests, and resource baseline helper.

## Scope

- `scripts/db/generate-resource-field-completion-audit.ts`
- `src/lib/__tests__/resource-field-completion-audit.test.ts`
- `src/lib/__tests__/textbook-media-grounding.test.ts`
- `src/lib/learning-goal-resource-baseline.ts`

## Out of Scope

- Do not mark resources semantically complete.
- Do not change resource readiness data beyond typed helper contract fixes.
- Do not address unrelated tsc clusters.

## Acceptance Checklist

- [ ] AC-1: The resource-governance cluster reports zero TypeScript errors. Owner: independent reviewer.
  Evidence: filtered `rtk npx tsc --noEmit --pretty false` output for scoped files.
- [ ] AC-2: Resource review audit and evidence-contract semantics are not weakened. Owner: independent reviewer.
  Evidence: focused tests and reviewer source inspection.
- [ ] AC-3: Full typecheck is rerun and remaining errors are outside this scope. Owner: independent reviewer.
  Evidence: full `rtk npx tsc --noEmit --pretty false` output.

## Tasks

- [ ] Task 1: Reproduce scoped TypeScript errors.
  Covers: AC-1
  Acceptance: Current errors for the scoped files are listed before changes.
  Evidence: baseline tsc output.
  Reviewer Check: Confirm the scoped file list matches this issue.
- [ ] Task 2: Repair helper/source type mismatches.
  Covers: AC-1, AC-2
  Acceptance: Production helper changes preserve review and evidence semantics.
  Evidence: diff and focused tests.
  Reviewer Check: Confirm no semantic completion is fabricated.
- [ ] Task 3: Update stale resource-governance fixtures.
  Covers: AC-1, AC-2
  Acceptance: Fixtures include required current fields rather than casts that hide contract drift.
  Evidence: diff and focused tests.
  Reviewer Check: Confirm casts are not used to bypass meaningful fields.
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
- Keep changes surgical and scoped to listed files unless a direct typed helper dependency requires a minimal adjacent edit.
- Do not use `as any`, broad `unknown` casts, or type suppression to hide real contract drift.
- Do not execute other planned OpenSpec changes.
