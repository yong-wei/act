# konling-kaq-graph-context Specification

## Purpose
Define the server-owned K/A/Q graph grounding contract that Konling uses when explaining graph-aware paths, resources, overlays, citations, and versioned learning context.
## Requirements
### Requirement: Konling graph context is server-owned
The system SHALL provide a server-owned graph context payload for Konling graph-aware advice.

#### Scenario: Graph context is assembled
- **WHEN** Konling starts from a path, graph-center, diagnosis, or prep-pack surface that supports graph-aware advice
- **THEN** the runtime SHALL assemble LearningGoal, selected graph nodes, ExpandedGoalSubgraph, learner or class overlay, ResourceCoverage, path artifact, citation refs, evidence refs, and version refs from server-owned sources where available
- **AND** client-provided page hints SHALL NOT expand accessible graph nodes, resources, learner evidence, class evidence, path records, or permissions.

#### Scenario: Graph context is incomplete
- **WHEN** required goal, graph, overlay, resource, path, citation, or version context is missing for a personalized graph claim
- **THEN** the context SHALL include explicit missing-grounding limitations
- **AND** the assistant SHALL degrade or avoid the personalized claim rather than presenting generic advice as graph-grounded.

### Requirement: Graph-aware answers expose grounding
Konling graph-aware answers SHALL expose the evidence basis for path, graph, and resource claims.

#### Scenario: Path advice is generated
- **WHEN** Konling explains why a graph-driven path or path node is recommended
- **THEN** the answer SHALL reference the relevant LearningGoal, graph nodes, path artifact, resource coverage, learner or class overlay where authorized, citation refs, evidence refs, confidence, and limitations
- **AND** missing or low-confidence grounding SHALL be visible to the caller.

#### Scenario: Resource advice is generated
- **WHEN** Konling recommends a resource for a graph node or LearningGoal
- **THEN** the recommendation SHALL distinguish path eligibility, retrieval/citation readiness, evidence capability, and resource coverage state
- **AND** it SHALL NOT treat a retrievable chunk as a path-eligible resource unless ResourceNode or checkpoint audit authorizes it.

### Requirement: Konling graph context is not evidence writeback
Konling graph context SHALL remain a grounding and explanation contract, not a direct mastery writeback channel.

#### Scenario: Assistant narrative mentions mastery
- **WHEN** Konling emits graph-grounded prose about learner understanding or capability
- **THEN** that narrative SHALL NOT directly mutate learner or class overlay state
- **AND** only governed tool outcomes, approved grading, path execution, simulation, Arena, or other materialized evidence may affect K/A/Q overlay state.
