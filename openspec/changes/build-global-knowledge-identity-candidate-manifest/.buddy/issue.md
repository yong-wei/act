---
change_id: build-global-knowledge-identity-candidate-manifest
claim_branch: build-global-knowledge-identity-candidate-manifest
series: course-knowledge-governance-manifests
coupling_group: course-knowledge-governance-manifests
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - inventory-course-knowledge-governance-inputs
parent_issue:
blocked_by:
  - inventory-course-knowledge-governance-inputs
blocking:
  - partition-course-knowledge-semantic-blocks
openspec_path: openspec/changes/build-global-knowledge-identity-candidate-manifest
risk: medium
area: knowledge-governance
---

## Goal

Produce exhaustive global identity equivalence components and review-only near-similar edges without approving final identities.

## Scope

- Form globally closed equivalence components only from exact normalized names and reviewed controlled aliases; each component remains indivisible and has no block owner before partitioning.
- Record near-similar evidence only as edges between distinct components, plus pending internal split, resolved `course-scope-anchor/v1` evidence references, and historical mapping representations.
- Apply `docs/contexts/course-knowledge-base/CONTEXT.md`, the ADR 0015-0044 files indexed by `docs/adr/README.md`, and `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Out of Scope

- Approved merges, splits, renames, archives, canonical IDs, or final semantic names.
- Domain assignment, block partitioning, relation adjudication, or resource binding.

## Acceptance Checklist

- [ ] AC-1: Every inventoried concept belongs to exactly one globally closed equivalence component derived only from hard equivalence evidence. Owner: independent reviewer.
  Evidence: fixed inventory fixture, exhaustive membership assertions, component-closure tests, and forbidden-owner fixtures.
- [ ] AC-2: Near-similar evidence produces deterministic review edges between distinct components, and scope-anchor references remain review evidence rather than admission truth. Owner: independent reviewer.
  Evidence: repeat-run manifest comparison, similarity fixtures, and no-auto-merge assertions.
- [ ] AC-3: Pending split and historical mapping ambiguity remain internal unresolved dispositions, with no block owner or approved canonical outcome. Owner: independent reviewer.
  Evidence: forbidden-outcome schema tests and mixed-node split fixture.

## Tasks

- [ ] Task 1: Generate exhaustive hard-equivalence components.
  Covers: AC-1
  Acceptance: Every source node appears in exactly one stable component and no component emits `owner_block`.
  Evidence: membership and count fixture output.
  Reviewer Check: Confirm no source node or exact conflict group is omitted.
- [ ] Task 2: Add deterministic near-similar review edges between components.
  Covers: AC-2
  Acceptance: Edge evidence, algorithm/version, source digest, and stable component identities survive input-order changes without automatic merging.
  Evidence: permutation and repeat-run tests.
  Reviewer Check: Confirm similarity scores rank candidates but never become merge truth.
- [ ] Task 3: Preserve pending split/merge and historical mapping states.
  Covers: AC-3
  Acceptance: Mixed nodes retain one stable component ID plus explicit alternatives and no approved identity outcome is serialized.
  Evidence: schema rejection and ambiguity fixtures.
  Reviewer Check: Confirm historical evidence is not copied across possible split outputs.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Do not adjudicate candidate identities or modify canonical data.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
