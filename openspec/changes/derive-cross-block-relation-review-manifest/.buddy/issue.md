---
change_id: derive-cross-block-relation-review-manifest
claim_branch: derive-cross-block-relation-review-manifest
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
openspec_path: openspec/changes/derive-cross-block-relation-review-manifest
risk: medium
area: knowledge-governance
---

## Goal

Freeze a provenance-complete cross-block relation review queue after endpoint ownership stabilizes, without approving relation outcomes.

## Scope

- Reconcile every raw relation into deterministic deduplicated adjudication units and report observed cardinalities from the bound snapshot.
- Derive exact cross-block units with source IDs, endpoint signatures, proposed family/direction, evidence, ownership, dependencies, and source digests.
- Apply `docs/contexts/course-knowledge-base/CONTEXT.md`, the ADR 0015-0044 files indexed by `docs/adr/README.md`, and `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Out of Scope

- Approving type, direction, directness, compatibility, evidence, acyclicity, or release.
- Writing authoring, runtime, or database relations.

## Acceptance Checklist

- [ ] AC-1: All observed raw relation IDs reconcile to the snapshot-derived adjudication-unit count without provenance loss or duplicate assignment. Owner: independent reviewer.
  Evidence: full raw-to-unit reconciliation fixture.
- [ ] AC-2: Every eligible cross-block unit has exact source IDs, endpoint signature, proposed family/direction, owner/endpoint blocks, blockedBy, evidence, and source digests. Owner: independent reviewer.
  Evidence: queue schema and ownership fixtures.
- [ ] AC-3: Stale endpoints, placeholders, duplicates, missing ownership, and approved relation outcomes fail validation. Owner: independent reviewer.
  Evidence: adversarial relation-queue fixtures.

## Tasks

- [ ] Task 1: Normalize and reconcile raw relation provenance.
  Covers: AC-1
  Acceptance: Every raw ID maps to one adjudication unit and observed cardinalities match the bound snapshot derivation report.
  Evidence: reconciliation report and duplicate/loss assertions.
  Reviewer Check: Confirm deduplication does not discard source evidence.
- [ ] Task 2: Derive exact cross-block queue records after frozen ownership.
  Covers: AC-2
  Acceptance: Every eligible unit appears once with complete exact scheduling metadata.
  Evidence: cross-block selection and schema tests.
  Reviewer Check: Confirm no provisional snapshot count is hard-coded as truth.
- [ ] Task 3: Enforce freshness and no-approval boundaries.
  Covers: AC-3
  Acceptance: Invalid records fail and proposed family/direction never become an approval.
  Evidence: negative fixtures.
  Reviewer Check: Confirm no canonical relation or production projection changes.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Do not approve or publish relations.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
## ADR 0045 Boundary

Historical facts/events, learner-derived state, inactive references, replay, backfill, and full-history decoder/writer closure are out of scope.
