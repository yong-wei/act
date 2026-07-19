## ADDED Requirements

### Requirement: Relation units preserve provenance and reference candidate components
The manifest SHALL deduplicate relation evidence by versioned typed signature while preserving every raw source ID. Endpoints SHALL reference candidate identity component IDs and SHALL NOT claim that canonical endpoint identity has been finalized.

#### Scenario: Several source rows describe one candidate relation
- **WHEN** their normalized typed signatures match
- **THEN** one review unit SHALL retain all source IDs and digests
- **AND** source cardinality drift SHALL be reported as expected/observed evidence rather than a permanent spec constant.

### Requirement: Only canonical relation families are proposed
Each review unit MAY propose `contains`, `prerequisite`, or `association`, direction, directness, and evidence, but SHALL NOT approve family, direction, endpoint identity, compatibility, or publication.

#### Scenario: A cross-block relation is emitted
- **WHEN** its candidate component endpoints have frozen owners
- **THEN** the record SHALL include one coordination owner and all endpoint blocks.

### Requirement: Relation queue output uses the future-child contract
Records SHALL follow the shared future-child schema and include typed exact items, change-ID dependencies, `schema_version`, `algorithm_version`, `normalization_profile`, structured `source_digests`, `governance_contract_digest`, `source_snapshot_digest`, structured `upstream_manifest_digests`, acceptance profile, required outputs, and scope anchors.

#### Scenario: An endpoint or upstream digest is stale
- **WHEN** validation compares expected and observed values
- **THEN** readiness SHALL fail and no relation outcome SHALL be serialized.
