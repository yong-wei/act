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

Validate one complete exact future-series manifest under the bounded ADR 0045 cutover contract.

## Scope

- Validate typed exact records, owners, endpoints, dependencies, digests, outputs, acceptance profiles, and scope anchors.
- Require new projections, reviewed active legacy mappings, active-reference migration, legacy compatibility, and post-cutover new-fact revision binding.
- Preserve the existing #947–#955 dependency topology.

## Out of Scope

- Historical fact backfill, event replay, and evidence deduplication.
- Portrait, diagnosis, risk, growth, recommendation, class, or Arena reconciliation.
- Polymorphic historical source-ID closure, complete historical decoders, or full-root writer equality.
- Creating stage-two issues or executing cutover.

## Acceptance Checklist

- [ ] AC-1: Every preparation record passes exact schema, owner, endpoint, dependency, acceptance-profile, anchor, and digest validation.
- [ ] AC-2: The cutover candidate contains only new projections, reviewed mappings, active references, legacy compatibility, and the post-cutover new-fact revision gate.
- [ ] AC-3: Historical and learner-derived diagnostic records cannot affect readiness.
- [ ] AC-4: Synthetic and frozen-snapshot tests prove deterministic, read-only validation.

## Tasks

- [ ] Task 1: Implement exact future-child and dependency validation.
- [ ] Task 2: Implement bounded cutover-readiness validation.
- [ ] Task 3: Reject historical diagnostics as readiness items.
- [ ] Task 4: Add deterministic positive and negative fixtures.
