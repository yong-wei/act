---
change_id: derive-controlled-knowledge-domain-candidate-manifest
claim_branch: derive-controlled-knowledge-domain-candidate-manifest
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
openspec_path: openspec/changes/derive-controlled-knowledge-domain-candidate-manifest
risk: medium
area: knowledge-governance
---

## Goal

Derive a reviewable flat domain-candidate manifest and dimension-pollution queue without fixing final vocabulary cardinality or assigning concepts.

## Scope

- Derive candidate names, definitions, inclusion boundaries, exclusion boundaries, evidence, and review status.
- Classify observed labels as semantic domain, course structure, navigation/topic filter, or invalid/unknown.
- Preserve the versioned seed set only as non-binding evidence.
- Apply `docs/contexts/course-knowledge-base/CONTEXT.md`, the ADR 0015-0044 files indexed by `docs/adr/README.md`, and `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Out of Scope

- Concept-domain membership or primary-domain selection.
- Domain hierarchy, block ownership, UI migration, or production metadata changes.

## Acceptance Checklist

- [ ] AC-1: Every domain candidate has a unique proposed name, complete boundaries, evidence, and review status, without a fixed final count. Owner: independent reviewer.
  Evidence: candidate schema, uniqueness tests, and seed-drift fixtures.
- [ ] AC-2: Every observed mixed-dimension label receives an explicit typed migration disposition. Owner: independent reviewer.
  Evidence: observed-label coverage fixture and migration-table assertions.
- [ ] AC-3: The candidate manifest contains no hierarchy, concept membership, owner, approved migration outcome, or final domain decision. Owner: independent reviewer.
  Evidence: forbidden-field and prohibited-dimension negative fixtures.

## Tasks

- [ ] Task 1: Derive and validate flat domain candidates.
  Covers: AC-1
  Acceptance: Every candidate has a stable candidate ID, unique proposed name, definition, inclusion/exclusion boundaries, evidence, and review status; seed count is not an invariant.
  Evidence: schema, uniqueness, and seed-drift output.
  Reviewer Check: Confirm no child-domain structure exists.
- [ ] Task 2: Define migration dispositions for every observed source label.
  Covers: AC-2
  Acceptance: Semantic, course, navigation/topic, and invalid/unknown dimensions are complete and explicit.
  Evidence: full observed-label fixture comparison.
  Reviewer Check: Confirm polluted labels are preserved as evidence but not promoted to domains.
- [ ] Task 3: Enforce the no-assignment boundary.
  Covers: AC-3
  Acceptance: Concept membership, ownership, hierarchy, and final identity fields fail validation.
  Evidence: negative schema fixtures.
  Reviewer Check: Confirm this change emits candidates only and does not approve a final vocabulary.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Do not assign concepts or change runtime domain metadata.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
## ADR 0045 Boundary

Historical facts/events, learner-derived state, and inactive legacy references are out of scope and cannot establish domain membership or readiness.
