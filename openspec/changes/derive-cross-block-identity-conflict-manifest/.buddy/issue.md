---
change_id: derive-cross-block-identity-conflict-manifest
claim_branch: derive-cross-block-identity-conflict-manifest
series: course-knowledge-governance-manifests
coupling_group: course-knowledge-governance-manifests
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - partition-course-knowledge-semantic-blocks
parent_issue:
blocked_by:
  - partition-course-knowledge-semantic-blocks
blocking:
  - derive-cross-block-relation-review-manifest
  - derive-atomic-resource-binding-review-manifest
  - validate-course-knowledge-series-manifest
openspec_path: openspec/changes/derive-cross-block-identity-conflict-manifest
risk: medium
area: knowledge-governance
---

## Goal

Freeze a deduplicated cross-block near-similar review queue and hard-fail exact/controlled-alias ownership leakage without approving any identity outcome.

## Scope

- Validate that each exact-name or reviewed-alias equivalence component remains wholly inside one owner block.
- Derive review records only for near-similar edges connecting distinct components in different owner blocks.
- Record stable component IDs, typed items, owner/endpoint blocks, dependencies, evidence, and layered source digests.
- Apply `docs/contexts/course-knowledge-base/CONTEXT.md`, the ADR 0015-0044 files indexed by `docs/adr/README.md`, and `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Out of Scope

- Approved merges, splits, renames, archives, canonical IDs, or migration mappings.
- Repartitioning blocks or changing governed content.

## Acceptance Checklist

- [ ] AC-1: Cross-block exact-name or reviewed-alias leakage fails validation rather than entering a review queue. Owner: independent reviewer.
  Evidence: exact-leakage and alias-leakage negative fixtures.
- [ ] AC-2: Every eligible cross-block near-similar edge appears exactly once with stable component IDs, typed items, owner/endpoint blocks, blockedBy, evidence, and source digests. Owner: independent reviewer.
  Evidence: schema validation and deterministic output comparison.
- [ ] AC-3: Missing/stale ownership, placeholders, duplicate conflicts, and approved identity outcomes fail validation. Owner: independent reviewer.
  Evidence: adversarial queue fixtures.

## Tasks

- [ ] Task 1: Validate hard-equivalence ownership and derive near-similar signatures.
  Covers: AC-1
  Acceptance: Exact/alias leakage fails; every eligible near-similar edge is present once; no same-owner edge enters the queue.
  Evidence: full reconciliation output.
  Reviewer Check: Confirm exact and alias evidence never becomes a queue item and canonical ordering prevents duplicate near-similar records.
- [ ] Task 2: Emit exact scheduling and provenance metadata.
  Covers: AC-2
  Acceptance: One deterministic owner coordinates review while every affected block and source digest remains visible.
  Evidence: schema and permutation tests.
  Reviewer Check: Confirm exact IDs and all endpoint blocks are present.
- [ ] Task 3: Enforce freshness and no-approval boundaries.
  Covers: AC-3
  Acceptance: Stale or incomplete records fail and no canonical disposition is serialized.
  Evidence: negative fixtures.
  Reviewer Check: Confirm the queue schedules review only and cannot mutate identity truth.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Do not approve identity outcomes or modify canonical identities.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
## ADR 0045 Boundary

Historical facts/events, completed paths, learner-derived state, replay, deduplication, backfill, and full-history decoder/writer closure are out of scope.
