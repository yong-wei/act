---
change_id: derive-atomic-resource-binding-review-manifest
claim_branch: derive-atomic-resource-binding-review-manifest
series: course-knowledge-governance-manifests
coupling_group: course-knowledge-governance-manifests
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - partition-course-knowledge-semantic-blocks
  - derive-cross-block-identity-conflict-manifest
parent_issue:
blocked_by:
  - partition-course-knowledge-semantic-blocks
  - derive-cross-block-identity-conflict-manifest
blocking:
  - validate-course-knowledge-series-manifest
openspec_path: openspec/changes/derive-atomic-resource-binding-review-manifest
risk: medium
area: knowledge-governance
---

## Goal

Freeze an exact atomic resource-binding review manifest that separates twelve entity types, atomic units, derived container summaries, and four canonical role candidates without approving bindings.

## Scope

- Distinguish twelve entity types and recursively split each container into non-overlapping sibling leaf units; an unsplittable long document may be one `teaches` unit without fine-grained assessment evidence.
- Emit exactly-once atomic provenance separately from zero-to-many candidate-component role records; keep unresolved boundaries and roles explicitly incomplete.
- Use `teaches`, `practices`, `assesses`, and `references` with role-specific evidence, preserving activity order, feedback, misconception, teacher aggregation, and progression semantics.
- Apply `docs/contexts/course-knowledge-base/CONTEXT.md`, the ADR 0015-0044 files indexed by `docs/adr/README.md`, and `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Out of Scope

- Formal binding approval, container binding truth, or resource publication.
- TeachingResource, registry, course-content, Prisma, runtime, or learning-evidence mutation.

## Acceptance Checklist

- [ ] AC-1: Every inventoried leaf resolves exactly once as an atomic unit or unresolved boundary, with ordered parent containers and no nested double counting or swallowed sibling content. Owner: independent reviewer.
  Evidence: full resource input reconciliation fixture.
- [ ] AC-2: Binding candidates use four canonical roles and key `(atomic_unit_id, component_id, role)`, allowing zero-to-many roles without duplicating atomic units. Owner: independent reviewer.
  Evidence: role and typed-identity fixtures plus schema validation.
- [ ] AC-3: Container bindings as truth, stale/ambiguous endpoints, placeholders, and approved binding outcomes fail validation. Owner: independent reviewer.
  Evidence: adversarial resource-manifest fixtures.

## Tasks

- [ ] Task 1: Classify and reconcile atomic, container-summary, and unresolved resource records.
  Covers: AC-1
  Acceptance: Every source leaf appears once, mixed teaching/activity/checkpoint siblings remain distinct, nested parents are containers, and long-document fallback cannot imply fine-grained assessment.
  Evidence: reconciliation report and coverage tests.
  Reviewer Check: Confirm containers do not become an independent binding source.
- [ ] Task 2: Emit four canonical role candidates and isolate all twelve entity types.
  Covers: AC-2
  Acceptance: Role and identity types remain explicit, role-specific evidence is complete, multi-role candidates do not duplicate atomic units, and unresolved roles remain review items.
  Evidence: role matrix, typed collision fixture, and schema output.
  Reviewer Check: Confirm no external ID can masquerade as a canonical knowledge ID.
- [ ] Task 3: Enforce endpoint freshness and no-approval boundaries.
  Covers: AC-3
  Acceptance: Ambiguous/stale records remain unresolved or fail, and no formal binding is serialized.
  Evidence: negative fixtures.
  Reviewer Check: Confirm no resource, runtime, database, or learning-evidence mutation occurs.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Do not approve bindings or modify resource/runtime data.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
