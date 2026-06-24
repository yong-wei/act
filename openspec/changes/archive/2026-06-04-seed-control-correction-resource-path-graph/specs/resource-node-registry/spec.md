## ADDED Requirements

### Requirement: Registry provides an audited control-correction seed graph
The system SHALL provide a versioned ResourceNode seed graph for the `control-correction` goal.

#### Scenario: Seed graph is loaded
- **WHEN** the ResourceNode registry loads the control-correction seed graph
- **THEN** it SHALL expose path-eligible nodes for knowledge card, handout or lecture, video, quiz, simulation, Arena task, reflection, and AI intervention resources
- **AND** each node SHALL include stable id, source reference, launch target, knowledge coverage, estimated time, prerequisite edges, evidence instrumentation, privacy policy, and eligibility status.

#### Scenario: Seed node is incomplete
- **WHEN** a control-correction seed node lacks a verified launch target, knowledge mapping, evidence instrumentation, prerequisite validity, or privacy policy
- **THEN** the registry audit SHALL mark the node as not path-eligible
- **AND** it SHALL expose an audit reason suitable for teacher or admin review.

#### Scenario: Terminal validation node is registered
- **WHEN** a simulation or Arena seed node is intended to validate transfer
- **THEN** the registry SHALL mark its terminal or validation role explicitly
- **AND** downstream planners SHALL be able to require that role without hard-coding node ids.
