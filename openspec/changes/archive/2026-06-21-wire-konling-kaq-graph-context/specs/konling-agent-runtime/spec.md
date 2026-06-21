## MODIFIED Requirements

### Requirement: Konling reads server-owned adaptive context
Konling SHALL build runtime context from server-owned page context, learner state, plan context, graph context, and scoped memory rather than default or client-provided profile values.

#### Scenario: Graph-aware Konling context is loaded
- **WHEN** Konling starts or receives a message on a graph-aware path, graph-center, diagnosis, or prep-pack surface
- **THEN** it SHALL load the available Konling graph context in addition to page context, learner state, current plan context, recent evidence, memory summaries, and permitted tools
- **AND** missing graph context classes SHALL be visible to prompt construction, tool input preparation, and response rationale.

### Requirement: Konling coaching is path-aware and citation-enforced
Konling SHALL provide graph-aware path coaching from server-owned path and graph context, consume path comparison, selection history, terminal validation context, and graph grounding, and attach required citations to coaching claims.

#### Scenario: Personalized graph path explanation is generated
- **WHEN** a student asks why a graph-driven path or node was recommended
- **THEN** Konling SHALL ground the answer in LearningGoal metadata, ExpandedGoalSubgraph, authorized learner or class overlay, ResourceCoverage, path option context, selection history, and verified citations where available
- **AND** it SHALL disclose missing or low-confidence goal, graph, resource, overlay, path, version, or citation context as a limitation.
