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
The Repository MUST distinguish candidate, active, and legacy authority states in selectors, response types, caches, and authorization checks, and MUST also distinguish immutable staged/rejected Authority Snapshot states. An `active` request SHALL resolve one current pointer and one snapshot identity; it MUST NOT infer Authority from CourseCoverage or a Teaching Projection.

#### Scenario: Candidate is requested
- **WHEN** a candidate-aware preview consumer selects a candidate ReleaseSet
- **THEN** the Repository SHALL return only that candidate and mark it non-authoritative for production writes

#### Scenario: Formal consumer requests active authority
- **WHEN** a formal consumer does not explicitly opt into candidate preview
- **THEN** the Repository SHALL resolve only the active production authority

#### Scenario: Engineering consumer requests active Authority
- **WHEN** `authority/current.json` names a verified snapshot whose digest matches its manifest
- **THEN** the Repository SHALL return only that snapshot's engineering objects and relations

#### Scenario: Current pointer is missing or mismatched
- **WHEN** the pointer is absent, malformed, or its snapshot/digest does not match
- **THEN** the Repository SHALL return an explicit unavailable result
- **AND** it SHALL not fall back to an arbitrary candidate or partially written directory

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
Adding the Repository and projections MUST NOT change the authority used by existing formal consumers. Teaching/resource consumers SHALL remain on their existing Legacy or explicitly pinned combination until their own projection gates pass. Engineering Authority MAY activate independently and MUST NOT mutate teaching selectors as a side effect.

#### Scenario: Repository deployment completes
- **WHEN** this change is deployed before final cutover
- **THEN** legacy production queries and fact writers SHALL retain their existing active authority

#### Scenario: Engineering pointer activates first
- **WHEN** a valid Authority Snapshot becomes current but the teaching projection is empty or unresolved
- **THEN** engineering graph and Engineering RAG MAY use the new Authority
- **AND** course, path, KAQ, and Teaching Resource RAG consumers SHALL retain their prior selector

### Requirement: Aggregate candidate identity is end-to-end consistent
Every candidate Repository query, response, cache key, and diagnostic MUST bind the explicitly selected ReleaseSet, Release and runtime Projection digest. A completed #1125 candidate SHALL use its frozen exact CTKG 0.2 diagnosis, while a standard candidate SHALL use its persisted Bundle, Schema, Artifact-contract and accepted-import receipt identities. Rows or diagnostics from different candidates MUST NOT be combined.

#### Scenario: Aggregate candidate is queried
- **WHEN** a consumer selects the current candidate
- **THEN** all returned objects, relations, and provenance SHALL belong to the one aggregate ReleaseSet and projection digest selected for that query, and SHALL NOT combine rows from another ReleaseSet

#### Scenario: Explicit standard candidate is queried
- **WHEN** an authorized consumer selects an accepted standard candidate by exact ReleaseSet and Release identity
- **THEN** all returned objects, relations, provenance and diagnostics SHALL belong to that ReleaseSet and runtime Projection digest

#### Scenario: Completed v0.2 candidate is queried
- **WHEN** a consumer selects the #1125 aggregate candidate
- **THEN** the Repository SHALL retain its frozen exact-contract validation and SHALL NOT require a later Manifest-only identity

#### Scenario: Historical result is requested
- **WHEN** an auditor explicitly requests a prior ReleaseSet
- **THEN** the Repository SHALL return it as historical and SHALL NOT label it current or reuse it in another candidate's readiness

#### Scenario: Candidate receipt is missing or mismatched
- **WHEN** a standard ReleaseSet lacks its accepted receipt or any persisted Bundle, Release, Schema or Projection identity disagrees
- **THEN** the Repository SHALL fail closed without reading Release files or falling back to Legacy

### Requirement: Public projection is not promoted to private dataset authority
The Repository MUST distinguish imported public release/projection records from unavailable private CTKGDataset records.

#### Scenario: Consumer requests private-only content
- **WHEN** a consumer asks for content not present in the public aggregate bundle
- **THEN** the Repository SHALL return an explicit unavailable result and SHALL NOT synthesize it from display descriptions or crosswalk identifiers

### Requirement: Explicit standard candidates preserve existing runtime contracts
The Repository MUST map a verified standard candidate to the existing `act.canvas.v2`, `act.node-detail.v2`, and `act.migration-review.v1` contracts without changing their public API shape, and MUST preserve valid unregistered types and predicates for generic read-only consumers. Snapshot readers MUST preserve typed object, exact relation, provenance, and role-scoped projection contracts. A candidate/staged snapshot MUST never be returned as active through implicit fallback.

#### Scenario: Compatible later Release is queried
- **WHEN** a standard candidate uses registered contracts but contains different valid counts, types, predicates or components
- **THEN** the Repository SHALL return its actual persisted values through the existing projection contracts without applying #1125 fixture totals

#### Scenario: Consumer lacks specialized semantics
- **WHEN** a valid standard candidate type or predicate has no specialized business adapter
- **THEN** the Repository SHALL keep it available for generic read-only projection and exclude it from unsupported business computation

#### Scenario: Candidate is requested explicitly
- **WHEN** a caller asks for a named candidate snapshot
- **THEN** the Repository SHALL return it with candidate/staged status and identity
- **AND** formal active readers SHALL continue resolving the current pointer only

