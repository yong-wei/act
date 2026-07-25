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

The knowledge graph source layer SHALL support an environment-gated ActKG `GraphProjection` JSON source alongside the existing file and database sources. When the gate is unset, the adapter SHALL NOT run and the default source selection SHALL be unchanged. When the gate is set, the adapter SHALL map `ProjectedNode` to unified nodes (`id` → `id`, `display_name` → `name`, `description` → `description`, `concept_kind` → `conceptKind`, `semantic_name` → `semanticName`, `candidate` → `candidate`, `source_coverage_count` → `sourceCoverageCount`) and `ProjectedLink` to unified links (`source_id`/`target_id` → `sourceId`/`targetId`, `relation_type` → canonical relation type, `evidence_state` → `evidenceState`). Adapter output SHALL pass the same relation-contract validation, coverage checks, node/link budgets, and byte budget as the file source, and SHALL fail closed with a descriptive error when the projection document is missing, malformed, or fails validation.

#### Scenario: Gate unset keeps default source
- **WHEN** the ActKG projection environment gate is not configured
- **THEN** graph loading uses the existing file-first, database-fallback chain with no adapter involvement

#### Scenario: Valid projection maps into unified payload
- **WHEN** the gate points to a projection document conforming to the ActKG projection JSON Schema
- **THEN** the adapter emits a unified payload whose nodes and links carry the mapped fields, and the payload passes relation-contract validation and coverage checks

#### Scenario: Malformed projection fails closed
- **WHEN** the gate points to a missing or schema-invalid projection document
- **THEN** graph loading fails closed with a descriptive adapter error and does not silently fall back to another source or emit a partial graph

### Requirement: Projection version binds to graph version identity

When the ActKG adapter is active, the projection's `version_digest` (with its source release identity) SHALL become the payload `graphVersion`/`versionDigest`, so progressive shard keys, client caches, and runtime coordinate invalidation behave exactly as they do for file and database sources. A projection whose digest changes SHALL invalidate prior shard caches and stored layout coordinates through the existing version-change path.

#### Scenario: Digest binds to shard identity
- **WHEN** the adapter loads a projection with `version_digest` D
- **THEN** every progressive shard derived from it validates against graph version D and stale shards keyed to a prior digest are rejected

#### Scenario: Digest change invalidates layout state
- **WHEN** a reload yields a projection whose `version_digest` differs from the previously loaded one
- **THEN** stored runtime node coordinates for the prior version are cleared through the existing version-invalidation path

### Requirement: Projected direction conflicts resolve by canonical contract

When an ActKG `ProjectedLink.direction` conflicts with the direction implied by the canonical relation contract for its mapped type, the canonical contract table SHALL win, the conflict SHALL be recorded in the link's provenance, and loading SHALL continue. When the projected direction agrees with the contract, no provenance conflict marker is added.

#### Scenario: Contract wins on conflict
- **WHEN** a projected link of relation type `contains` declares direction `unordered`
- **THEN** the emitted link uses direction `parent-to-child` from the canonical contract and its provenance records the overridden projected direction

#### Scenario: Agreement adds no conflict marker
- **WHEN** a projected link of relation type `prerequisite` declares direction `earlier_to_later`
- **THEN** the emitted link uses direction `earlier-to-later` and carries no direction-conflict provenance marker

