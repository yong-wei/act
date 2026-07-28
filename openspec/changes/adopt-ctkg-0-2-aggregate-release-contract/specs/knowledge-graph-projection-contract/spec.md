## MODIFIED Requirements

### Requirement: ActKG graph projection loads as a gated graph source
The candidate knowledge graph source layer SHALL load the locked CTKG 0.2 `GraphProjection` V2 only through the aggregate Repository candidate selector. The adapter SHALL validate the pinned GraphProjection V2 contract, map every public node and link field without semantic coercion, and apply the existing graph budgets and authorization boundary. The Legacy source selection SHALL remain unchanged for production consumers until final cutover.

#### Scenario: Valid aggregate projection maps into candidate payload
- **WHEN** the Repository returns the locked `control-theory-engineering-v0.2` projection conforming to the pinned CTKG 0.2 contract
- **THEN** the adapter SHALL emit a candidate payload containing all 744 nodes and 97 links with their upstream identities, types, tiers, predicates, directions, families, evidence state, and projection provenance

#### Scenario: Candidate projection is unavailable or invalid
- **WHEN** the aggregate projection is absent, schema-invalid, hash-invalid, or inconsistent with the selected ReleaseSet
- **THEN** candidate loading SHALL fail closed with a descriptive error and SHALL NOT fall back to Legacy or emit a partial candidate graph

#### Scenario: Production selector remains Legacy
- **WHEN** a formal graph consumer has not explicitly entered the candidate V2 path
- **THEN** the existing production source selection SHALL remain unchanged

### Requirement: Projection version binds to graph version identity
When the CTKG 0.2 candidate adapter is active, the aggregate ReleaseSet identity, source release hash, source dataset hash, and `version_digest` SHALL jointly identify the payload, caches, progressive shards, and stored layout state.

#### Scenario: Aggregate identity binds to shard identity
- **WHEN** the adapter loads a projection with version digest D from aggregate ReleaseSet R
- **THEN** every progressive shard SHALL validate against both R and D and SHALL reject a shard from any prior ReleaseSet or digest

#### Scenario: Release or digest changes
- **WHEN** either the selected aggregate ReleaseSet or its `version_digest` differs from the stored version
- **THEN** candidate caches and stored runtime coordinates for the prior identity SHALL be invalidated through the existing version-change path

## REMOVED Requirements

### Requirement: Projected direction conflicts resolve by canonical contract
**Reason**: CTKG 0.2 is consumed through a pinned, lossless projection contract; silently overriding an upstream direction would make ACT's candidate projection differ from the locked public release.

**Migration**: Replace runtime override behavior with import-time validation under `Projected relation semantics match the pinned contract`; historical CTKG 0.1 projections remain readable through their exact adapter.

## ADDED Requirements

### Requirement: Projected relation semantics match the pinned contract
Every CTKG 0.2 projected link MUST preserve its upstream `relation_type`, `direction`, and `relation_family`, and the importer MUST fail closed when those fields violate the pinned consumer contract or relation vocabulary.

#### Scenario: Projected relation is valid
- **WHEN** a link's predicate, direction, family, endpoints, and evidence state conform to the pinned CTKG 0.2 contract
- **THEN** the candidate payload SHALL preserve those values exactly

#### Scenario: Projected relation conflicts with the contract
- **WHEN** a link declares an invalid direction, family, predicate, or endpoint combination
- **THEN** the complete aggregate import SHALL fail and no corrected relation SHALL be fabricated
