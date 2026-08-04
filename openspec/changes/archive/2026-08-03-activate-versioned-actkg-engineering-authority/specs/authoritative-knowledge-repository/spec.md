## MODIFIED Requirements

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

### Requirement: Legacy production remains active before cutover
Adding the Repository and projections MUST NOT change the authority used by existing formal consumers. Teaching/resource consumers SHALL remain on their existing Legacy or explicitly pinned combination until their own projection gates pass. Engineering Authority MAY activate independently and MUST NOT mutate teaching selectors as a side effect.

#### Scenario: Repository deployment completes
- **WHEN** this change is deployed before final cutover
- **THEN** legacy production queries and fact writers SHALL retain their existing active authority

#### Scenario: Engineering pointer activates first
- **WHEN** a valid Authority Snapshot becomes current but the teaching projection is empty or unresolved
- **THEN** engineering graph and Engineering RAG MAY use the new Authority
- **AND** course, path, KAQ, and Teaching Resource RAG consumers SHALL retain their prior selector

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
