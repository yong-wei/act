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

Freeze the bounded, reproducible inventory required to rebuild current course knowledge truth and migrate active references.

## Scope

- Inventory current formal-course/reviewed anchors, current authoring content/cards/media/resources, current published graph/binding comparison, active references, and reviewed active legacy mappings.
- Classify active references by actual current reading or continued execution.
- Reject historical diagnostic inputs without generating, consuming, or validating a catalog.

## Out of Scope

- Historical fact/event replay, reinterpretation, deduplication, or backfill.
- Portrait, diagnosis, risk, growth, recommendation, class, or Arena reconciliation.
- Full-history decoder closure, lineage reconstruction, and full-root writer equality.
- Semantic governance decisions or production migration.

## Acceptance Checklist

- [ ] AC-1: Readiness output contains exactly the five authoritative input classes; historical diagnostic inputs are rejected and no diagnostic catalog is produced.
- [ ] AC-2: Active references are limited to current course/resource/progress/note and `LearningPath` rows where `pathStatus != completed` and a declared current business reader still reads or continues them; admitted paths inventory every nested knowledge/resource reference selected by `remapAdaptivePathPayloadReferences`, while completed paths are excluded before payload decoding.
- [ ] AC-3: Historical facts resolve only through their original revision or explicit legacy compatibility and are never backfilled.
- [ ] AC-4: Fixed-snapshot and synthetic tests prove deterministic, no-write behavior and source drift reporting.

## Tasks

- [ ] Task 1: Implement bounded current-truth and active-reference inventory.
- [ ] Task 2: Reject historical and learner-state inputs before readiness evaluation without maintaining a diagnostic catalog.
- [ ] Task 3: Add revised synthetic and fixed-snapshot tests proving nested prerequisite/readiness/pathOptions/policyBundle legacy IDs are inventoried for admitted incomplete paths and identical completed-path payloads are excluded, with no historical trajectory fixtures.
- [ ] Task 4: Validate deterministic output and no-write behavior.

## Boundary reset

All earlier completion evidence predates ADR 0045 and is invalid for this revised contract. Every acceptance item and task must be reverified under the bounded scope.
