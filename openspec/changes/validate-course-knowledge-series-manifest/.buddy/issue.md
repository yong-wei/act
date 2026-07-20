---
change_id: validate-course-knowledge-series-manifest
claim_branch: validate-course-knowledge-series-manifest
series: course-knowledge-governance-manifests
coupling_group: course-knowledge-governance-manifests
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - derive-cross-block-identity-conflict-manifest
  - derive-cross-block-relation-review-manifest
  - derive-atomic-resource-binding-review-manifest
parent_issue:
blocked_by:
  - derive-cross-block-identity-conflict-manifest
  - derive-cross-block-relation-review-manifest
  - derive-atomic-resource-binding-review-manifest
blocking: []
openspec_path: openspec/changes/validate-course-knowledge-series-manifest
risk: medium
area: knowledge-governance
---

## Goal

Validate one complete placeholder-free exact manifest that can later drive second-stage Buddy propose without governing content or creating changes.

## Scope

- Validate typed items/counts, layered source digests, field applicability, ownership, endpoints, complete input disposition, and dependency closure.
- Reconcile Prisma DMMF fields, versioned path/event decoders, replay sources, and the full-root AST-discovered writer set before assigning every direct writer one cutover disposition; require history/path migration, learner-derived semantic invariants, projection import, DB-only read-model, split-aware per-final-concept card/visual review, snapshot-proof, and privacy-suppression items.
- Require the complete discriminated schema for every future child record, including work kind, schema/algorithm/normalization versions, structured items, separate governance/source-snapshot/per-source/upstream digests, required outputs, acceptance profile, and scope anchors.
- Apply `docs/contexts/course-knowledge-base/CONTEXT.md`, the ADR 0015-0044 files indexed by `docs/adr/README.md`, and `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Out of Scope

- Identity, domain, relation, resource, card, or migration decisions.
- Second-stage OpenSpec creation, GitHub mutation, governed-content changes, or production release.

## Acceptance Checklist

- [ ] AC-1: Every preparation manifest passes schema/algorithm/normalization version, layered-digest, exact count/list, split-aware final-concept card/visual closure, registry/DMMF/writer/snapshot/privacy, ownership, endpoint, input-disposition, and dependency-closure checks. Owner: independent reviewer.
  Evidence: complete manifest fixture and deterministic validation report.
- [ ] AC-2: Placeholders, stale digests, missing/duplicate ownership, omitted inputs, count mismatches, missing endpoints, and dependency cycles fail without waivers. Owner: independent reviewer.
  Evidence: adversarial fixture matrix and nonzero exits.
- [ ] AC-3: Every future child satisfies the discriminated schema for its work kind, with namespace-aware typed items and no OpenSpec child or production release created. Owner: independent reviewer.
  Evidence: output schema, field-applicability fixtures, namespace-collision fixtures, and repository before/after check.

## Tasks

- [ ] Task 1: Validate complete manifest and dependency closure.
  Covers: AC-1
  Acceptance: Every inventoried item has one owner or explicit typed non-governance disposition and every dependency resolves acyclically.
  Evidence: complete fixture report and repeat-run comparison.
  Reviewer Check: Confirm valid empty queues still carry zero count, empty exact list, derivation evidence, and source digest.
- [ ] Task 2: Reject every provisional or incomplete shortcut without waiver.
  Covers: AC-2
  Acceptance: Each prohibited defect returns a nonzero result naming the exact failure; no `--allow-missing` path exists.
  Evidence: adversarial fixture matrix.
  Reviewer Check: Confirm production waiver, wildcard, range, TODO, and provisional owner forms are all rejected.
- [ ] Task 3: Emit exact future-series readiness only.
  Covers: AC-3
  Acceptance: All applicable discriminated fields are complete and output is limited to deterministic manifest/report artifacts.
  Evidence: output schema and filesystem no-mutation assertion.
  Reviewer Check: Confirm no second-stage change, governed-content decision, or release artifact is created.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Do not use `--allow-missing`, any waiver, or create second-stage changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
