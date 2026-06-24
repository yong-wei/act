## ADDED Requirements

### Requirement: Resource nodes expose adaptive path readiness metadata
ResourceNodes that can appear in adaptive learning paths SHALL expose readiness metadata when their execution depends on prior competency, evidence, completed nodes, or external outcomes.

#### Scenario: Heavy node is registered for path planning
- **WHEN** a ResourceNode represents Arena, advanced simulation, control workbench validation, terminal validation, or another high-complexity path node
- **THEN** its path metadata SHALL declare minimum competency, minimum evidence count, required completed node ids, required outcome references, unlock message, and fallback node ids where applicable
- **AND** the metadata SHALL be available to the adaptive path planner without requiring the student UI to infer readiness from display text.

#### Scenario: Readiness metadata is missing
- **WHEN** a high-complexity ResourceNode lacks audited readiness metadata
- **THEN** the planner SHALL treat the node as not immediately executable
- **AND** the node MAY appear only as a locked future milestone with a student-facing preparation message.
