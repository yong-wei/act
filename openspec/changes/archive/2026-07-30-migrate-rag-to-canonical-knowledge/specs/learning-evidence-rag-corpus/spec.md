## ADDED Requirements

### Requirement: RAG uses Canonical knowledge as a retrieval signal
RAG SHALL use aggregate Canonical Object identity, aliases, explicitly supported precise relations, and governed ACT Crosswalks for entity alignment and bounded candidate expansion.

#### Scenario: Canonical entity is aligned
- **WHEN** a query matches a supported Canonical Object
- **THEN** RAG MAY expand candidates through supported relations and ACT Crosswalk seeds while retaining aggregate ReleaseSet and Crosswalk provenance

#### Scenario: Relation is unsupported
- **WHEN** a stored predicate has no RAG semantic adapter
- **THEN** RAG MUST NOT use it for query expansion

### Requirement: Graph content is not final answer evidence
Canonical summaries, relations, and upstream RAG references MUST NOT directly satisfy the final answer citation requirement.

#### Scenario: Graph identifies a relevant concept
- **WHEN** the graph expands the query to a candidate object
- **THEN** the answer SHALL cite independently retrieved and verified ACT content rather than the object summary

### Requirement: Canonical RAG remains shadow before cutover
The RAG authority selector MUST remain on Legacy production retrieval until the final downtime cutover activates all formal consumers together.

#### Scenario: Canonical shadow retrieval succeeds
- **WHEN** Canonical entity alignment and citations pass validation before cutover
- **THEN** the system SHALL record comparison evidence without using the Canonical result as the user's production answer

#### Scenario: Final selector activates
- **WHEN** the final cutover transaction activates the Canonical RAG selector
- **THEN** production retrieval SHALL use Canonical expansion and MUST NOT fall back to Legacy knowledge
