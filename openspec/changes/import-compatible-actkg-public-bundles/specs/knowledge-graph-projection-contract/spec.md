## MODIFIED Requirements

### Requirement: ActKG graph projection loads as a gated graph source
The candidate knowledge graph source layer SHALL load a selected accepted candidate only through the aggregate Repository candidate selector. For #1125 it SHALL retain the frozen CTKG 0.2 GraphProjection V2 adapter; for a standard Bundle it SHALL map the one compatibility-validated runtime Projection to the existing candidate payload without semantic coercion. The Legacy source selection SHALL remain unchanged for production consumers until final cutover.

#### Scenario: Valid standard runtime Projection maps into unified payload
- **WHEN** the Repository returns an accepted standard candidate with one validated runtime Projection
- **THEN** the adapter SHALL emit all persisted runtime nodes and links with their upstream identities, types, tiers, predicates, directions, families, evidence state and Projection provenance

#### Scenario: Completed v0.2 Projection is requested
- **WHEN** the Repository returns the #1125 aggregate candidate
- **THEN** the adapter SHALL retain its exact CTKG 0.2 contract and fixture behavior

#### Scenario: Projection is malformed or mismatched
- **WHEN** the selected runtime Projection is absent, receipt-invalid, digest-invalid or inconsistent with the selected ReleaseSet
- **THEN** candidate loading SHALL fail closed and SHALL NOT fall back to Legacy or emit a partial graph

#### Scenario: Gate unset keeps default source
- **WHEN** a formal graph consumer has not explicitly entered the candidate V2 path
- **THEN** the existing production source selection SHALL remain unchanged

### Requirement: Projection version binds to graph version identity
For every candidate adapter, the ReleaseSet identity, Release identity, source release hash, source dataset hash, runtime Projection profile and version digest SHALL jointly identify the payload, caches, progressive shards and stored layout state.

#### Scenario: Digest binds to shard identity
- **WHEN** the adapter loads runtime Projection profile P with version digest D from ReleaseSet R
- **THEN** every progressive shard SHALL validate against R, P and D and SHALL reject a shard from another ReleaseSet, profile or digest

#### Scenario: Candidate identity changes
- **WHEN** the selected ReleaseSet, Release, runtime profile or version digest differs from stored state
- **THEN** candidate caches and stored runtime coordinates for the prior identity SHALL be invalidated through the existing version-change path

### Requirement: Projected relation semantics match the registered contract
Every candidate projected link MUST preserve its upstream predicate, direction, relation family and endpoints. The #1125 adapter MUST enforce its pinned CTKG 0.2 semantic table, while a standard candidate MUST enforce the registered Schema and Artifact contracts carried by its validated import. No adapter may repair, infer or coerce a conflicting relation.

#### Scenario: Standard projected relation is valid
- **WHEN** a link's predicate, direction, family, endpoint types and evidence state conform to the registered contracts of its candidate
- **THEN** the candidate payload SHALL preserve those values exactly

#### Scenario: Projected relation conflicts with its contract
- **WHEN** a link violates the pinned historical contract or the registered standard contract selected for its ReleaseSet
- **THEN** the complete candidate load SHALL fail and no corrected relation SHALL be fabricated
