---
change_id: fix-resource-media-rag-typecheck-debt
claim_branch: fix-resource-media-rag-typecheck-debt
series: release-signal-noise-elimination
coupling_group: none
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/fix-resource-media-rag-typecheck-debt
risk: medium
area: resource-governance
---

## Goal

Eliminate the ResourceNode/media/RAG TypeScript no-emit cluster: 13 current errors across media manifest, Source Pack, RAG citation, and ResourceNode projection contracts.

## Scope

- `src/lib/__tests__/resource-node-registry.test.ts`
- `src/lib/__tests__/source-pack-corpus-adapters.test.ts`
- `src/lib/__tests__/source-pack.test.ts`
- `src/lib/data-governance/__tests__/learning-evidence-rag-corpus.test.ts`
- `src/lib/resource-node-registry.ts`

## Out of Scope

- Do not promote citation-only records to PathNodes.
- Do not change resource semantic readiness.
- Do not address unrelated tsc clusters.

## Acceptance Checklist

- [ ] AC-1: The ResourceNode/media/RAG cluster reports zero TypeScript errors. Owner: independent reviewer.
  Evidence: filtered `rtk npx tsc --noEmit --pretty false` output for scoped files.
- [ ] AC-2: Citation and ResourceNode planning boundaries are preserved. Owner: independent reviewer.
  Evidence: focused tests and reviewer source inspection.
- [ ] AC-3: Full typecheck is rerun and remaining errors are outside this scope. Owner: independent reviewer.
  Evidence: full `rtk npx tsc --noEmit --pretty false` output.

## Tasks

- [ ] Task 1: Reproduce scoped TypeScript errors.
  Covers: AC-1
  Acceptance: Current errors for the scoped files are listed before changes.
  Evidence: baseline tsc output.
  Reviewer Check: Confirm the scoped file list matches this issue.
- [ ] Task 2: Align media manifest fixtures.
  Covers: AC-1, AC-2
  Acceptance: Segment ids, graph-node refs, scene availability, and mutability match current contracts.
  Evidence: diff and focused tests.
  Reviewer Check: Confirm invalid fixtures are fixed rather than cast away.
- [ ] Task 3: Align Source Pack and RAG citation fixtures.
  Covers: AC-1, AC-2
  Acceptance: Required citation/source fields are present and server-owned citation boundaries remain intact.
  Evidence: diff and focused tests.
  Reviewer Check: Confirm model-authored URLs are not treated as verified citations.
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
- Keep edits scoped to listed files unless a directly imported type helper needs a minimal update.
- Do not use `as any`, broad `unknown` casts, or type suppression to hide real contract drift.
- Do not execute other planned OpenSpec changes.
