## MODIFIED Requirements

### Requirement: Retrieval separates teaching knowledge and learner evidence
The retrieval layer SHALL distinguish high-authority teaching knowledge from personalized learner evidence. RAG MUST additionally separate Engineering Authority retrieval from Teaching Resource Projection retrieval. A composed query MAY use both domains only when the response records each domain's Authority/Projection/scope and citation provenance; learner evidence remains independently governed.

#### Scenario: Concept explanation is requested
- **WHEN** a user requests a course concept explanation
- **THEN** retrieval SHALL prioritize high-authority course content, terminology, runtime handouts, textbooks, reference sections, figures, knowledge cards, and graph-bound resource chunks
- **AND** learner evidence SHALL NOT be required unless the answer makes personalized claims.
- **AND** missing learner evidence SHALL NOT prevent the response from returning verified teaching-content citations when those citations are available.

#### Scenario: Personalized recommendation is requested
- **WHEN** a diagnosis, path, grading, Konling, or prep-pack response makes a personalized claim
- **THEN** retrieval SHALL include authorized learner evidence where available
- **AND** the response SHALL expose a limitation when learner evidence is missing or low confidence.
- **AND** the limitation SHALL affect personalization scope, confidence, and recommendation style rather than causing teaching-content retrieval to fail.

#### Scenario: Engineering-only query
- **WHEN** a query asks about an engineering entity or exact relation without a course scope
- **THEN** retrieval SHALL use Engineering Authority only
- **AND** it SHALL not require Teaching Projection

#### Scenario: Teaching query has a course scope
- **WHEN** a query asks for a lesson explanation or prerequisite-backed resource
- **THEN** retrieval SHALL use the scoped Teaching Projection domain
- **AND** optional card absence SHALL be reported without hiding other resources

### Requirement: RAG uses Canonical knowledge as a retrieval signal
RAG SHALL use aggregate Canonical Object identity, aliases, explicitly supported precise relations, and governed ACT Crosswalks for entity alignment and bounded candidate expansion. Canonical retrieval MUST be constrained by the active Authority/Projection combination and MUST carry Canonical ID, release/projection identity, resource role, scope, and citation metadata. ACT teaching relations MUST remain query-time projection data and MUST NOT be written into ActKG.

#### Scenario: Canonical entity is aligned
- **WHEN** a query matches a supported Canonical Object
- **THEN** RAG MAY expand candidates through supported relations and ACT Crosswalk seeds while retaining aggregate ReleaseSet and Crosswalk provenance

#### Scenario: Relation is unsupported
- **WHEN** a stored predicate has no RAG semantic adapter
- **THEN** RAG MUST NOT use it for query expansion

#### Scenario: Projection identity drifts
- **WHEN** a resource or prerequisite result belongs to another projection/current pointer
- **THEN** the result SHALL be rejected or marked unavailable
- **AND** no mixed-version answer context SHALL be sent to the model

### Requirement: Canonical RAG remains shadow before cutover
The RAG authority selector MUST remain on Legacy production retrieval until the final downtime cutover activates all formal consumers together. Card migration MUST not switch formal RAG authority by itself. Until the consumer activation gate passes, card queries SHALL use the explicit Legacy/pinned fallback combination and expose migration/fallback provenance. Until consumer activation passes, Engineering and Teaching Resource RAG SHALL use their explicit Legacy/pinned combinations and expose shadow/fallback provenance. A new projection query alone MUST NOT change a production selector.

#### Scenario: Legacy fallback is used
- **WHEN** a step still resolves through a legacy card crosswalk
- **THEN** RAG SHALL record the fallback hit and legacy identity
- **AND** it SHALL not write a new Canonical authority selector

#### Scenario: Canonical shadow retrieval succeeds
- **WHEN** Canonical entity alignment and citations pass validation before cutover
- **THEN** the system SHALL record comparison evidence without using the Canonical result as the user's production answer

#### Scenario: Final selector activates
- **WHEN** the final cutover transaction activates the Canonical RAG selector
- **THEN** production retrieval SHALL use Canonical expansion and MUST NOT fall back to Legacy knowledge

#### Scenario: Teaching RAG is pinned
- **WHEN** Engineering Authority is newer but Teaching Projection activation is not ready
- **THEN** Engineering RAG MAY use the newer Authority
- **AND** Teaching Resource RAG SHALL remain on its pinned combination
