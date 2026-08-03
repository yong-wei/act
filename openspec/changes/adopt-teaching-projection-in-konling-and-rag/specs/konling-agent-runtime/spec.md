## MODIFIED Requirements

### Requirement: Konling reads server-owned adaptive context
Konling MUST resolve the current Authority/Teaching Projection combination on the server and MAY include `authorityReleaseId`, `projectionId`, scoped Canonical IDs, linked teaching resources, prerequisite ancestors/successors, and optional card metadata. Client-supplied IDs MUST be revalidated and MUST NOT select another learner's or course's projection.

#### Scenario: Course context is valid
- **WHEN** an authenticated learner asks within a current lesson scope
- **THEN** Konling SHALL carry the server-resolved Authority/Projection identities and scoped resources
- **AND** the context SHALL include only permitted prerequisite/card metadata

#### Scenario: Projection is unavailable
- **WHEN** the requested Teaching Projection is missing, stale, or unauthorized
- **THEN** Konling SHALL return explicit unavailable or Legacy/pinned fallback status
- **AND** it SHALL not infer teaching resources from raw ActKG labels

### Requirement: Konling grounds answers in knowledge and capability context
Knowledge answers MUST distinguish Engineering Authority facts from Teaching Resource evidence and retain domain, Authority, Projection, Canonical, resource, and citation identities. Teaching prerequisites MUST NOT be written back to ActKG through answer generation or tool calls.

#### Scenario: Engineering and teaching sources are composed
- **WHEN** a response uses both engineering relations and a course handout/card
- **THEN** the answer metadata SHALL retain separate domain provenance and citations
- **AND** no cross-domain teaching edge SHALL be persisted

#### Scenario: Optional card is absent
- **WHEN** a Canonical ID has no active optional card
- **THEN** Konling MAY use node summary or other projected resource evidence
- **AND** it SHALL not claim that the Canonical node is absent
