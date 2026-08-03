## MODIFIED Requirements

### Requirement: Knowledge authority states are isolated
The Repository MUST distinguish immutable `candidate`, `active`, `legacy`, and staged/rejected Authority Snapshot states. An `active` request SHALL resolve one current pointer and one snapshot identity; it MUST NOT infer Authority from CourseCoverage or a Teaching Projection.

#### Scenario: Engineering consumer requests active Authority
- **WHEN** `authority/current.json` names a verified snapshot whose digest matches its manifest
- **THEN** the Repository SHALL return only that snapshot's engineering objects and relations

#### Scenario: Current pointer is missing or mismatched
- **WHEN** the pointer is absent, malformed, or its snapshot/digest does not match
- **THEN** the Repository SHALL return an explicit unavailable result
- **AND** it SHALL not fall back to an arbitrary candidate or partially written directory

### Requirement: Legacy production remains active before cutover
Teaching/resource consumers SHALL remain on their existing Legacy or explicitly pinned combination until their own projection gates pass. Engineering Authority MAY activate independently and MUST NOT mutate teaching selectors as a side effect.

#### Scenario: Engineering pointer activates first
- **WHEN** a valid Authority Snapshot becomes current but the teaching projection is empty or unresolved
- **THEN** engineering graph and Engineering RAG MAY use the new Authority
- **AND** course, path, KAQ, and Teaching Resource RAG consumers SHALL retain their prior selector

### Requirement: Explicit standard candidates preserve existing runtime contracts
Snapshot readers MUST preserve typed object, exact relation, provenance, and role-scoped projection contracts. A candidate/staged snapshot MUST never be returned as active through implicit fallback.

#### Scenario: Candidate is requested explicitly
- **WHEN** a caller asks for a named candidate snapshot
- **THEN** the Repository SHALL return it with candidate/staged status and identity
- **AND** formal active readers SHALL continue resolving the current pointer only
