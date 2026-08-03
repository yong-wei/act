## MODIFIED Requirements

### Requirement: Retrieval separates teaching knowledge and learner evidence
RAG MUST additionally separate Engineering Authority retrieval from Teaching Resource Projection retrieval. A composed query MAY use both domains only when the response records each domain's Authority/Projection/scope and citation provenance; learner evidence remains independently governed.

#### Scenario: Engineering-only query
- **WHEN** a query asks about an engineering entity or exact relation without a course scope
- **THEN** retrieval SHALL use Engineering Authority only
- **AND** it SHALL not require Teaching Projection

#### Scenario: Teaching query has a course scope
- **WHEN** a query asks for a lesson explanation or prerequisite-backed resource
- **THEN** retrieval SHALL use the scoped Teaching Projection domain
- **AND** optional card absence SHALL be reported without hiding other resources

### Requirement: RAG uses Canonical knowledge as a retrieval signal
Canonical retrieval MUST be constrained by the active Authority/Projection combination and MUST carry Canonical ID, release/projection identity, resource role, scope, and citation metadata. ACT teaching relations MUST remain query-time projection data and MUST NOT be written into ActKG.

#### Scenario: Projection identity drifts
- **WHEN** a resource or prerequisite result belongs to another projection/current pointer
- **THEN** the result SHALL be rejected or marked unavailable
- **AND** no mixed-version answer context SHALL be sent to the model

### Requirement: Canonical RAG remains shadow before cutover
Until consumer activation passes, Engineering and Teaching Resource RAG SHALL use their explicit Legacy/pinned combinations and expose shadow/fallback provenance. A new projection query alone MUST NOT change a production selector.

#### Scenario: Teaching RAG is pinned
- **WHEN** Engineering Authority is newer but Teaching Projection activation is not ready
- **THEN** Engineering RAG MAY use the newer Authority
- **AND** Teaching Resource RAG SHALL remain on its pinned combination
