---
change_id: inventory-course-knowledge-governance-inputs
claim_branch: inventory-course-knowledge-governance-inputs
series: course-knowledge-governance-manifests
coupling_group: course-knowledge-governance-manifests
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking:
  - build-global-knowledge-identity-candidate-manifest
  - derive-controlled-knowledge-domain-candidate-manifest
openspec_path: openspec/changes/inventory-course-knowledge-governance-inputs
risk: medium
area: knowledge-governance
---

## Goal

Freeze a reproducible inventory of every course-knowledge governance input without generating identity, domain, relation, or resource-binding judgments.

## Scope

- Record path, schema/version, deterministic hash, cardinality, and missing-input status.
- Reconcile all source-registry records, Prisma DMMF fields, versioned history/event decoders, full-root AST-discovered writers, authoring/runtime projections, nullable-scope anchors, and proved database snapshots; report observed counts without fixing unsupported snapshot cardinalities.
- Bind downstream work to `docs/contexts/course-knowledge-base/CONTEXT.md`, the ADR 0015-0044 files indexed by `docs/adr/README.md`, and `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Out of Scope

- Identity grouping or merge/split decisions.
- Domain membership, block ownership, relation approval, or binding approval.
- Any source mutation or production release.

## Acceptance Checklist

- [ ] AC-1: Every required input record has path, schema/version, deterministic hash, cardinality, and aggregate digest. Owner: independent reviewer.
  Evidence: fixed-fixture inventory output and schema validation.
- [ ] AC-2: The inventory closes every registry path, DMMF field, versioned path/event decoder, namespace, full-root AST-discovered writer/producer, and one transaction/export-proved database snapshot, or fails with exact drift evidence. Owner: independent reviewer.
  Evidence: registry/DMMF coverage, writer-set equality, snapshot-proof, aggregate-count, and drift fixtures.
- [ ] AC-3: Missing inputs remain explicit and no semantic decision fields are emitted. Owner: independent reviewer.
  Evidence: missing-input and forbidden-field negative fixtures.

## Tasks

- [ ] Task 1: Define and generate the versioned digest-bound input inventory.
  Covers: AC-1
  Acceptance: Every physical source and logical record set has all required provenance fields and deterministic ordering.
  Evidence: inventory schema, fixed fixture, and repeat-run digest comparison.
  Reviewer Check: Confirm physical and logical coverage are both represented and hashes are reproducible.
- [ ] Task 2: Reconcile all registry sources, selectors, and observed cardinalities.
  Covers: AC-2
  Acceptance: Every registry source, DMMF field, selector, media projection and discovered writer reconciles; observed counts remain versioned evidence and validation names the drifting source and expected/observed count.
  Evidence: field/writer closure, count reconciliation and drift tests.
  Reviewer Check: Confirm no missing records are hidden by aggregate-only totals.
- [ ] Task 3: Preserve missing inputs and semantic exclusions.
  Covers: AC-3
  Acceptance: Missing sources block readiness and identity/domain/relation/binding decision fields are absent.
  Evidence: adversarial fixture output and schema rejection tests.
  Reviewer Check: Confirm the change inventories evidence only and synthesizes no replacement data.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Do not mutate inventoried sources or make semantic judgments.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
