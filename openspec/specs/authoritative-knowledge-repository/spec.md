# authoritative-knowledge-repository Specification

## Purpose
TBD - created by archiving change add-authoritative-knowledge-repository. Update Purpose after archive.
## Requirements
### Requirement: Repository is the only runtime reader of authoritative knowledge
Runtime consumers MUST query imported ActKG data through `AuthoritativeKnowledgeRepository`, and the Repository MUST read the validated database model rather than Release files or the ActKG project.

#### Scenario: Database candidate exists
- **WHEN** a consumer requests a candidate ReleaseSet
- **THEN** the Repository SHALL return database-backed authoritative objects and relations with their version identity

#### Scenario: Database candidate is unavailable
- **WHEN** the requested candidate ReleaseSet is absent
- **THEN** the Repository SHALL return an explicit unavailable result and MUST NOT read files or fall back to legacy knowledge

### Requirement: Knowledge authority states are isolated
The Repository MUST distinguish candidate, active, and legacy authority states in selectors, response types, caches, and authorization checks.

#### Scenario: Candidate is requested
- **WHEN** a candidate-aware preview consumer selects a candidate ReleaseSet
- **THEN** the Repository SHALL return only that candidate and mark it non-authoritative for production writes

#### Scenario: Formal consumer requests active authority
- **WHEN** a formal consumer does not explicitly opt into candidate preview
- **THEN** the Repository SHALL resolve only the active production authority

### Requirement: First projection set is bounded and versioned
The Repository SHALL provide `act.canvas.v2`, `act.node-detail.v2`, and `act.migration-review.v1`, each declaring its projection version, aggregate source ReleaseSet, source release hash, source dataset hash, projection digest, included fields, and hidden fields.

#### Scenario: Canvas projection is built
- **WHEN** `act.canvas.v2` is requested for `control-theory-engineering-v0.2`
- **THEN** it SHALL preserve all public typed object identities, exact relation predicates, direction, relation family, release tier, and evidence state needed by the canvas

#### Scenario: Detail projection is built
- **WHEN** `act.node-detail.v2` is requested for an authorized role
- **THEN** it SHALL return only the detail fields allowed for that role and SHALL preserve the aggregate ReleaseSet provenance

#### Scenario: Migration review is built
- **WHEN** an administrator requests `act.migration-review.v1`
- **THEN** it SHALL report aggregate ingest, component validation, stale shadow outputs, Legacy archive readiness, and active-consumer rebinding status without changing authoritative data

### Requirement: Storage support and consumer semantic support are separate
The Repository MUST preserve all current-Schema-valid types and predicates while requiring each business consumer to declare which semantics it supports.

#### Scenario: Generic valid type is queried
- **WHEN** a valid object type lacks a specialized consumer adapter
- **THEN** the Repository SHALL allow generic read-only projection and SHALL exclude it from unsupported business computation

### Requirement: Legacy production remains active before cutover
Adding the Repository and projections MUST NOT change the authority used by existing formal consumers.

#### Scenario: Repository deployment completes
- **WHEN** this change is deployed before final cutover
- **THEN** legacy production queries and fact writers SHALL retain their existing active authority

### Requirement: Aggregate candidate identity is end-to-end consistent
Every candidate Repository query, response, cache key, and diagnostic MUST bind the aggregate ReleaseSet identity and projection digest and MUST NOT combine rows from the prior root-locus ReleaseSet.

#### Scenario: Aggregate candidate is queried
- **WHEN** a consumer selects the current candidate
- **THEN** all returned objects, relations, and provenance SHALL belong to the one aggregate ReleaseSet and projection digest

#### Scenario: Historical result is requested
- **WHEN** an auditor explicitly requests a prior ReleaseSet
- **THEN** the Repository SHALL return it as historical and SHALL NOT label it current or reuse it in current readiness

### Requirement: Public projection is not promoted to private dataset authority
The Repository MUST distinguish imported public release/projection records from unavailable private CTKGDataset records.

#### Scenario: Consumer requests private-only content
- **WHEN** a consumer asks for content not present in the public aggregate bundle
- **THEN** the Repository SHALL return an explicit unavailable result and SHALL NOT synthesize it from display descriptions or crosswalk identifiers

