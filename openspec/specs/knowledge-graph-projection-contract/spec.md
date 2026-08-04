# knowledge-graph-projection-contract Specification

## Purpose
TBD - created by archiving change extend-knowledge-graph-projection-contract. Update Purpose after archive.
## Requirements
### Requirement: Public graph links carry an optional evidence state

The public graph payload (`PublicKnowledgeGraphLink`) SHALL expose an optional `evidenceState` field with values `'available' | 'unavailable'`. When the field is present, it SHALL be derived from the relation's existing evidence-bearing fields (rationale, evidence, source document, source metadata, or provenance) using the same derivation rule as the inspector's `hasAvailableEvidence` contract, and SHALL NOT be fabricated when no evidence exists. When the underlying source provides no evidence information, the field SHALL be omitted rather than guessed. Existing file and database sources SHALL continue to produce payloads whose previously defined fields are unchanged in shape and value.

#### Scenario: Link with rationale evidence reports available
- **WHEN** a knowledge relation in the active source carries a non-empty rationale, evidence text, source document, source metadata, or provenance
- **THEN** its public link includes `evidenceState: 'available'`

#### Scenario: Link without evidence reports unavailable
- **WHEN** a knowledge relation in the active source carries none of the evidence-bearing fields
- **THEN** its public link includes `evidenceState: 'unavailable'` and no evidence text is invented

#### Scenario: Existing payload fields remain stable
- **WHEN** the file or database source produces a public graph payload after this change
- **THEN** every field that existed before this change retains its prior name, type, and value semantics, and new fields are strictly additive and optional

### Requirement: Public graph nodes accept projection-shaped optional attributes

The public graph payload (`PublicKnowledgeGraphNode`) SHALL accept the optional fields `semanticName`, `conceptKind`, `candidate`, and `sourceCoverageCount` without requiring any current source to populate them. A current file or database source that lacks these attributes SHALL omit them, and consumers SHALL treat their absence as "unknown", never as a default classification. The `candidate` flag, when present and `true`, SHALL mark the node as a governance candidate that learner-facing views may exclude.

#### Scenario: Current sources omit unknown attributes
- **WHEN** the active source is the runtime file source or the database source and it holds no concept-kind, coverage, or candidacy data
- **THEN** emitted nodes omit `semanticName`, `conceptKind`, `candidate`, and `sourceCoverageCount` entirely

#### Scenario: Consumer treats absent attributes as unknown
- **WHEN** a consumer reads a node without `conceptKind` or `sourceCoverageCount`
- **THEN** it applies no assumed concept category and no assumed coverage weight for that node

### Requirement: Canonical association relation type is registered

The relation contract SHALL register a canonical relation type `association` mapped to family `association` and direction `unordered`, so that projections exposing the three-value relation vocabulary (`contains`, `prerequisite`, `association`) round-trip without contract violations. Registering the type SHALL NOT alter the family, direction, strength, or visual semantics of any previously registered canonical type, and duplicate or reversed-identity protections SHALL apply to `association` edges the same way they apply to existing association-family types.

#### Scenario: Association projection edge passes contract validation
- **WHEN** a source relation declares relation type `association` between two distinct active nodes
- **THEN** the relation contract resolves it to family `association` and direction `unordered` without blocking projection

#### Scenario: Existing canonical types are unaffected
- **WHEN** the canonical `association` type is registered
- **THEN** every previously registered canonical type keeps its existing family, direction, strength normalization, and deduplication behavior

### Requirement: ActKG graph projection loads as a gated graph source
The candidate knowledge graph source layer SHALL load a selected accepted candidate only through the aggregate Repository candidate selector. For #1125 it SHALL retain the frozen CTKG 0.2 GraphProjection V2 adapter; for a standard Bundle it SHALL map the one compatibility-validated runtime Projection to the existing candidate payload without semantic coercion. The Legacy source selection SHALL remain unchanged for production consumers until final cutover.

The graph projection MUST also expose Engineering Authority as one independent layer and MUST NOT treat ACT teaching/resource coverage as a prerequisite for loading it. ACT teaching prerequisites and resource bindings MAY be attached as separately gated layers with their own projection/scope identity.

#### Scenario: Valid projection maps into unified payload
- **WHEN** the Repository returns the locked `control-theory-engineering-v0.2` projection conforming to the pinned CTKG 0.2 contract
- **THEN** the adapter SHALL emit a candidate payload containing all 744 nodes and 97 links with their upstream identities, types, tiers, predicates, directions, families, evidence state, and projection provenance

#### Scenario: Valid standard runtime Projection maps into unified payload
- **WHEN** the Repository returns an accepted standard candidate with one validated runtime Projection
- **THEN** the adapter SHALL emit all persisted runtime nodes and links with their upstream identities, types, tiers, predicates, directions, families, evidence state and Projection provenance

#### Scenario: Completed v0.2 Projection is requested
- **WHEN** the Repository returns the #1125 aggregate candidate
- **THEN** the adapter SHALL retain its exact CTKG 0.2 contract and fixture behavior

#### Scenario: Malformed projection fails closed
- **WHEN** the aggregate projection is absent, schema-invalid, hash-invalid, or inconsistent with the selected ReleaseSet
- **THEN** candidate loading SHALL fail closed with a descriptive error and SHALL NOT fall back to Legacy or emit a partial candidate graph

#### Scenario: Projection is malformed or mismatched
- **WHEN** the selected runtime Projection is absent, receipt-invalid, digest-invalid or inconsistent with the selected ReleaseSet
- **THEN** candidate loading SHALL fail closed and SHALL NOT fall back to Legacy or emit a partial graph

#### Scenario: Gate unset keeps default source
- **WHEN** a formal graph consumer has not explicitly entered the candidate V2 path
- **THEN** the existing production source selection SHALL remain unchanged

#### Scenario: Authority is active and Teaching Projection is absent
- **WHEN** a graph request targets Engineering Authority and no teaching projection exists
- **THEN** engineering nodes and exact engineering relations SHALL load
- **AND** teaching/resource layers SHALL report absent or `NOT_PROJECTED` without blocking the graph

#### Scenario: Teaching layer is requested
- **WHEN** a caller requests a valid course scope and Teaching Projection combination
- **THEN** the payload SHALL include only scoped ACT prerequisite/resource records
- **AND** it SHALL not rewrite or union them into ActKG engineering relations

### Requirement: Projection version binds to graph version identity
For every candidate adapter, the ReleaseSet identity, Release identity, source release hash, source dataset hash, runtime Projection profile and version digest SHALL jointly identify the payload, caches, progressive shards and stored layout state.

Every layered graph response MUST identify the Authority release and, when present, Teaching Projection ID/scope and resource/prerequisite layer versions. Consumers MUST NOT silently combine records from different identities.

#### Scenario: Digest binds to shard identity
- **WHEN** the adapter loads a projection with version digest D from aggregate ReleaseSet R
- **THEN** every progressive shard SHALL validate against both R and D and SHALL reject a shard from any prior ReleaseSet or digest

#### Scenario: Digest change invalidates layout state
- **WHEN** either the selected aggregate ReleaseSet or its `version_digest` differs from the stored version
- **THEN** candidate caches and stored runtime coordinates for the prior identity SHALL be invalidated through the existing version-change path

#### Scenario: Candidate identity changes
- **WHEN** the selected ReleaseSet, Release, runtime profile or version digest differs from stored state
- **THEN** candidate caches and stored runtime coordinates for the prior identity SHALL be invalidated through the existing version-change path

#### Scenario: One layer drifts
- **WHEN** the requested Authority or Projection identity/hash does not match its manifest
- **THEN** that layer SHALL fail closed
- **AND** the response SHALL retain unaffected valid layers with explicit status

### Requirement: Candidate authoritative projection is isolated from Legacy projection
The projection layer MUST expose `act.canvas.v2` and `act.node-detail.v2` as contracts derived from one selected candidate ReleaseSet, and MUST keep the existing Legacy projection unchanged during migration.

Course and classroom consumers MAY read a named candidate/pinned combination for shadow or compatibility, but formal selectors MUST resolve either one validated combination or an explicit Legacy fallback.

#### Scenario: Candidate projection is requested
- **WHEN** the client requests a specific candidate ReleaseSet
- **THEN** the projection SHALL contain only objects and relations from that ReleaseSet and SHALL identify its projection version

#### Scenario: Legacy projection is requested
- **WHEN** the migration-period client selects the old graph
- **THEN** the existing Legacy DTO SHALL be returned without Canonical candidate objects

#### Scenario: Projection candidate is unavailable
- **WHEN** a course scope requests a missing candidate projection
- **THEN** the resolver SHALL return explicit unavailable/fallback status
- **AND** it SHALL not mix candidate resources with Legacy prerequisite or card data

### Requirement: Projected relation semantics match the pinned contract
Every candidate projected link MUST preserve its upstream predicate, direction, relation family and endpoints. The #1125 adapter MUST enforce its pinned CTKG 0.2 semantic table, while a standard candidate MUST enforce the registered Schema and Artifact contracts carried by its validated import. No adapter may repair, infer or coerce a conflicting relation.

#### Scenario: Projected relation is valid
- **WHEN** a link's predicate, direction, family, endpoints, and evidence state conform to the pinned CTKG 0.2 contract
- **THEN** the candidate payload SHALL preserve those values exactly

#### Scenario: Standard projected relation is valid
- **WHEN** a link's predicate, direction, family, endpoint types and evidence state conform to the registered contracts of its candidate
- **THEN** the candidate payload SHALL preserve those values exactly

#### Scenario: Projected relation conflicts with the contract
- **WHEN** a link declares an invalid direction, family, predicate, or endpoint combination
- **THEN** the complete aggregate import SHALL fail and no corrected relation SHALL be fabricated

#### Scenario: Projected relation conflicts with its contract
- **WHEN** a link violates the pinned historical contract or the registered standard contract selected for its ReleaseSet
- **THEN** the complete candidate load SHALL fail and no corrected relation SHALL be fabricated

