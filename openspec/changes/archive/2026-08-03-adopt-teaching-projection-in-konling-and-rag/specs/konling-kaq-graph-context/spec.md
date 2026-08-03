## MODIFIED Requirements

### Requirement: Konling graph context is server-owned
The system SHALL provide a server-owned graph context payload for Konling graph-aware advice. Graph context MUST resolve Authority, Teaching Projection, course scope, current Canonical IDs, linked resources, prerequisite neighborhood, and optional card through a server-owned contract. The client MAY provide a hint but MUST NOT provide authoritative teaching data.

#### Scenario: Graph context is assembled
- **WHEN** Konling starts from a path, graph-center, diagnosis, or prep-pack surface that supports graph-aware advice
- **THEN** the runtime SHALL assemble LearningGoal, selected graph nodes, ExpandedGoalSubgraph, learner or class overlay, ResourceCoverage, path artifact, citation refs, evidence refs, and version refs from server-owned sources where available
- **AND** client-provided page hints SHALL NOT expand accessible graph nodes, resources, learner evidence, class evidence, path records, or permissions.

#### Scenario: Graph context is incomplete
- **WHEN** required goal, graph, overlay, resource, path, citation, or version context is missing for a personalized graph claim
- **THEN** the context SHALL include explicit missing-grounding limitations
- **AND** the assistant SHALL degrade or avoid the personalized claim rather than presenting generic advice as graph-grounded.

#### Scenario: Signed context is valid
- **WHEN** a graph-aware request carries a valid scoped context token
- **THEN** the server SHALL re-resolve the listed IDs and include matching Authority/Projection identities
- **AND** it SHALL reject mismatched or out-of-scope IDs before tool execution

#### Scenario: Teaching layer is absent
- **WHEN** the Authority is valid but no teaching projection is available
- **THEN** the context SHALL expose that status
- **AND** engineering graph context MAY continue without synthesized teaching edges

### Requirement: Graph-aware answers expose grounding
Konling graph-aware answers SHALL expose the evidence basis for path, graph, and resource claims. Graph-aware answers MUST identify whether a claim came from Engineering Authority, Teaching Resource Projection, prerequisite data, or an optional card and MUST preserve citation-safe source identities.

#### Scenario: Path advice is generated
- **WHEN** Konling explains why a graph-driven path or path node is recommended
- **THEN** the answer SHALL reference the relevant LearningGoal, graph nodes, path artifact, resource coverage, learner or class overlay where authorized, citation refs, evidence refs, confidence, and limitations
- **AND** missing or low-confidence grounding SHALL be visible to the caller.

#### Scenario: Resource advice is generated
- **WHEN** Konling recommends a resource for a graph node or LearningGoal
- **THEN** the recommendation SHALL distinguish path eligibility, retrieval/citation readiness, evidence capability, and resource coverage state
- **AND** it SHALL NOT treat a retrievable chunk as a path-eligible resource unless ResourceNode or checkpoint audit authorizes it.

#### Scenario: Claim uses a teaching prerequisite
- **WHEN** a response explains why a course resource is recommended
- **THEN** it SHALL cite the ACT prerequisite/resource evidence and projection identity
- **AND** it SHALL not represent the relation as an ActKG engineering predicate
