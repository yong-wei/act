---
change_id: partition-course-knowledge-semantic-blocks
claim_branch: partition-course-knowledge-semantic-blocks
series: course-knowledge-governance-manifests
coupling_group: course-knowledge-governance-manifests
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - build-global-knowledge-identity-candidate-manifest
  - derive-controlled-knowledge-domain-candidate-manifest
parent_issue:
blocked_by:
  - build-global-knowledge-identity-candidate-manifest
  - derive-controlled-knowledge-domain-candidate-manifest
blocking:
  - derive-cross-block-identity-conflict-manifest
  - derive-cross-block-relation-review-manifest
  - derive-atomic-resource-binding-review-manifest
openspec_path: openspec/changes/partition-course-knowledge-semantic-blocks
risk: medium
area: knowledge-governance
---

## Goal

Assign every indivisible identity equivalence component to one deterministic 40–80-capacity semantic owner block and freeze exact scheduling metadata.

## Scope

- Consume the frozen identity-component manifest and domain-candidate/dimension-pollution manifest.
- Produce exhaustive non-overlapping owner blocks, endpoint blocks, exact typed items, complete layered digests, and per-component card/visual review work records.
- Apply `docs/contexts/course-knowledge-base/CONTEXT.md`, the ADR 0015-0044 files indexed by `docs/adr/README.md`, and `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Out of Scope

- Preserving any provisional block count or grandfathering a prototype.
- Final identity, domain membership, relation, card, or resource decisions.
- Creating second-stage content-block changes.

## Acceptance Checklist

- [ ] AC-1: Every identity equivalence component is assigned intact to exactly one owner block with no missing or duplicate ownership. Owner: independent reviewer.
  Evidence: exhaustive partition coverage and no-split assertions.
- [ ] AC-2: Every block records 40–80 owned components in `candidate_concept_count`, independently of `exact_count`, or a valid machine-readable exception. Owner: independent reviewer.
  Evidence: capacity and exception fixtures.
- [ ] AC-3: Every block record contains the shared schema, layered digests, and one card plus visual-suitability review item per component, with no final decisions or second-stage changes. Owner: independent reviewer.
  Evidence: manifest schema, forbidden-field tests, and repository directory check.

## Tasks

- [ ] Task 1: Generate exhaustive deterministic owner-block assignments.
  Covers: AC-1
  Acceptance: Every equivalence component has exactly one owner and no component is split.
  Evidence: coverage, uniqueness, and input-order permutation tests.
  Reviewer Check: Confirm assignment uses equivalence components as atomic units and near-similar edges do not merge them.
- [ ] Task 2: Enforce block capacity and explicit exceptions.
  Covers: AC-2
  Acceptance: Pending split counts once, typed non-concept items do not affect capacity, and out-of-range blocks identify a real indivisible component or connectivity constraint.
  Evidence: boundary and exception tests.
  Reviewer Check: Confirm no prototype count is grandfathered and `exact_count` is not used as capacity.
- [ ] Task 3: Freeze exact future scheduling records only.
  Covers: AC-3
  Acceptance: All exact metadata and per-component card/visual work records are present and no governance disposition or future change is generated.
  Evidence: schema, negative fixtures, and filesystem check.
  Reviewer Check: Confirm source digests make downstream endpoint ownership stale on upstream change.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Do not split identity equivalence components, adjudicate content, or create second-stage changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
## ADR 0045 Boundary

Only active-reference migration items and reviewed active legacy mappings enter block ownership. Historical facts/events, completed paths, learner-derived state, replay, deduplication, and backfill are out of scope.
