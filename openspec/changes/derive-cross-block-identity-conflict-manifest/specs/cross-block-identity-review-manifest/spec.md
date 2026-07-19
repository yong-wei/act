## ADDED Requirements

### Requirement: Cross-block identity output is a near-similar queue plus hard leakage checks
The manifest SHALL emit cross-block near-similar review edges between distinct identity components and SHALL separately validate that exact-name and reviewed-alias component membership never crosses owner blocks.

#### Scenario: Exact-name equivalence crosses blocks
- **WHEN** leakage validation finds one exact-name component in multiple blocks
- **THEN** validation SHALL fail rather than enqueue a review item.

#### Scenario: Reviewed-alias equivalence crosses blocks
- **WHEN** leakage validation finds one alias-equivalent component in multiple blocks
- **THEN** validation SHALL fail rather than enqueue a review item.

#### Scenario: Near-similar evidence crosses blocks
- **WHEN** two distinct components have qualifying near-similar evidence
- **THEN** one deterministic queue record SHALL preserve both component IDs and endpoint blocks
- **AND** no merge, split, rename, archive, or owner change SHALL be approved.

### Requirement: Queue records are reproducible and schedulable
Each record SHALL follow the shared future-child schema and include typed exact items, one coordination owner, complete endpoint blocks, change-ID `blockedBy`, `schema_version`, `algorithm_version`, `normalization_profile`, structured `source_digests`, `governance_contract_digest`, `source_snapshot_digest`, structured `upstream_manifest_digests`, evidence, acceptance profile, required outputs, and scope anchors.

#### Scenario: Upstream ownership changes
- **WHEN** an upstream manifest digest no longer matches
- **THEN** validation SHALL report expected/observed drift and fail readiness.
