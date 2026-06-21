## MODIFIED Requirements

### Requirement: ResourceNode graph supports planning constraints
The system SHALL expose graph edges and metadata needed by downstream adaptive path planning.

#### Scenario: Planner reads upgraded ResourceNode graph profile
- **WHEN** the planner reads ResourceNodes for a graph-driven LearningGoal
- **THEN** it SHALL be able to access graph node refs, scene availability, citation readiness, evidence capability, prerequisites, estimated time, cognitive load, availability, teacher policy, privacy level, terminal constraints, readiness, and governance limitations
- **AND** these fields SHALL come from audited ResourceNode or ResourceSemanticProjection metadata rather than raw source content.

### Requirement: Registry audits protect path quality
The system SHALL audit path-eligible resources.

#### Scenario: Segment is retrievable but not path eligible
- **WHEN** a resource segment or retrieval chunk has graph binding or citation readiness but lacks ResourceNode path audit approval
- **THEN** the audit SHALL keep it out of path generation
- **AND** diagnostics SHALL distinguish retrieval readiness from path eligibility.
