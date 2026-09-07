# konling-kaq-graph-context Specification

## Purpose
Define the server-owned K/A/Q graph grounding contract that Konling uses when explaining graph-aware paths, resources, overlays, citations, and versioned learning context.
## Requirements
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

### Requirement: Konling graph context is not evidence writeback
Konling graph context SHALL remain a grounding and explanation contract, not a direct mastery writeback channel.

#### Scenario: Assistant narrative mentions mastery
- **WHEN** Konling emits graph-grounded prose about learner understanding or capability
- **THEN** that narrative SHALL NOT directly mutate learner or class overlay state
- **AND** only governed tool outcomes, approved grading, path execution, simulation, Arena, or other materialized evidence may affect K/A/Q overlay state.

### Requirement: Engineering graph context enters grounding as a bounded neighborhood
The server-owned graph context SHALL expose engineering-domain knowledge to Konling as a bounded neighborhood summary derived from the engineering corpus, in addition to the existing focus-ID allowlist validation. The neighborhood summary MUST be limited to an allowlisted predicate set and a bounded entry count, and MUST retain engineering-domain provenance distinct from teaching-projection evidence.

#### Scenario: Engineering neighborhood summary is injected
- **WHEN** Konling answers a question whose focus Canonical IDs have engineering-graph neighbors under allowlisted predicates
- **THEN** the grounding context SHALL include a bounded engineering neighborhood summary with node identities, predicates, and directions
- **AND** the summary SHALL identify itself as engineering-domain grounding rather than teaching-projection evidence

#### Scenario: Neighborhood exceeds the bound
- **WHEN** the eligible engineering neighborhood for the focus set exceeds the configured entry limit
- **THEN** the context SHALL truncate to the bound deterministically
- **AND** the truncation SHALL be recorded in context metadata

#### Scenario: Engineering nodes carry textbook mappings
- **WHEN** an engineering node in the neighborhood has a governed textbook mapping to a structural unit of an extraction-source textbook
- **THEN** the context SHALL expose that mapping as a citation-eligible textbook reference with version-bound identity
- **AND** nodes without a governed mapping SHALL NOT be presented with a fabricated textbook source

#### Scenario: Engineering domain is unavailable
- **WHEN** the engineering corpus or layered payload is unavailable for the current Authority combination
- **THEN** the context SHALL expose that unavailability explicitly
- **AND** Konling SHALL NOT infer engineering relations from teaching-projection data or legacy knowledge nodes

