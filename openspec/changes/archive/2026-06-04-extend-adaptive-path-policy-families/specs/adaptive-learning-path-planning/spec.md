## ADDED Requirements

### Requirement: Planner supports explicit policy families
The adaptive learning path planner SHALL support explicit path policy families for registered learning goals.

#### Scenario: Foundation remediation path is requested
- **WHEN** a foundation-remediation policy is requested
- **THEN** the planner SHALL prioritize prerequisite repair, concept cards, short exercises, and low cognitive-load resources before terminal validation.

#### Scenario: Simulation-driven path is requested
- **WHEN** a simulation-driven policy is requested
- **THEN** the planner SHALL prioritize simulation, Arena, experiment, and reflection resources while preserving required prerequisites and evidence confidence limits.

#### Scenario: Sprint-correction path is requested
- **WHEN** a sprint-correction policy is requested
- **THEN** the planner SHALL prioritize the highest-impact weak indicators within the time budget and expose the tradeoff against breadth.

### Requirement: Displayed paths are meaningfully distinct
When multiple path styles are shown together, the system SHALL verify that they are meaningfully different.

#### Scenario: Multi-path bundle is generated
- **WHEN** a student is shown multiple path styles for the same goal
- **THEN** the bundle SHALL include overlap, modality mix, estimated effort, and terminal validation difference metrics
- **AND** resource overlap SHALL stay below the configured threshold unless a low-resource fallback is returned.
