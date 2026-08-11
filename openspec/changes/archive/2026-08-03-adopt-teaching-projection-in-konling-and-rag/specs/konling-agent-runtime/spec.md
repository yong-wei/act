## MODIFIED Requirements

### Requirement: Konling reads server-owned adaptive context
Konling SHALL build runtime context from server-owned page context, learner state, plan context, graph context, and scoped memory rather than default or client-provided profile values. Konling MUST resolve the current Authority/Teaching Projection combination on the server and MAY include `authorityReleaseId`, `projectionId`, scoped Canonical IDs, linked teaching resources, prerequisite ancestors/successors, and optional card metadata. Client-supplied IDs MUST be revalidated and MUST NOT select another learner's or course's projection.

#### Scenario: Graph-aware Konling context is loaded
- **WHEN** Konling starts or receives a message on a graph-aware path, graph-center, diagnosis, or prep-pack surface
- **THEN** it SHALL load the available Konling graph context in addition to page context, learner state, current plan context, recent evidence, memory summaries, and permitted tools
- **AND** missing graph context classes SHALL be visible to prompt construction, tool input preparation, and response rationale.

#### Scenario: Course context is valid
- **WHEN** an authenticated learner asks within a current lesson scope
- **THEN** Konling SHALL carry the server-resolved Authority/Projection identities and scoped resources
- **AND** the context SHALL include only permitted prerequisite/card metadata

#### Scenario: Projection is unavailable
- **WHEN** the requested Teaching Projection is missing, stale, or unauthorized
- **THEN** Konling SHALL return explicit unavailable or Legacy/pinned fallback status
- **AND** it SHALL not infer teaching resources from raw ActKG labels

### Requirement: Konling grounds answers in knowledge and capability context
Konling SHALL ground supported teaching-assistant answers in server-owned knowledge node, capability target, resource, learner, path, and citation context where available. Knowledge answers MUST distinguish Engineering Authority facts from Teaching Resource evidence and retain domain, Authority, Projection, Canonical, resource, and citation identities. Teaching prerequisites MUST NOT be written back to ActKG through answer generation or tool calls.

#### Scenario: Concept explanation is requested
- **WHEN** a student asks for a factual course concept explanation
- **THEN** Konling SHALL identify relevant knowledge nodes or resource context where available
- **AND** the answer SHALL prioritize verified teaching knowledge citations over learner evidence unless it makes a personalized claim.

#### Scenario: Personalized path advice is requested
- **WHEN** a student asks why a path, node, or resource is recommended
- **THEN** Konling SHALL ground the answer in capability targets, ResourceNode or PlanningUnit rationale, selected path context, and authorized learner evidence where available
- **AND** missing citation classes or low-confidence evidence SHALL be disclosed as limitations.

#### Scenario: Grading or mastery-impacting advice is generated
- **WHEN** Konling generates grading explanation, mastery advice, or diagnosis-affecting output
- **THEN** generated text SHALL remain explanatory unless a governed tool run, approved grading workflow, or materialized evidence summary records the outcome
- **AND** raw assistant narrative SHALL NOT directly update learner mastery.

#### Scenario: Engineering and teaching sources are composed
- **WHEN** a response uses both engineering relations and a course handout/card
- **THEN** the answer metadata SHALL retain separate domain provenance and citations
- **AND** no cross-domain teaching edge SHALL be persisted

#### Scenario: Optional card is absent
- **WHEN** a Canonical ID has no active optional card
- **THEN** Konling MAY use node summary or other projected resource evidence
- **AND** it SHALL not claim that the Canonical node is absent
