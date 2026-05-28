## ADDED Requirements

### Requirement: Agent tool runs reference canonical simulation runs
Simulation tool executions SHALL reference canonical SimulationRun and SimulationTrace records when creating, analyzing, comparing, or modifying simulation-related state.

#### Scenario: Tool creates a run
- **WHEN** an agent tool creates a simulation run
- **THEN** the resulting SimulationRun SHALL include the AgentSession or AgentToolRun reference where available
- **AND** the run SHALL keep owner-user isolation metadata.

#### Scenario: Tool analyzes a trace
- **WHEN** an agent tool analyzes a trace
- **THEN** the analysis result SHALL reference SimulationRun and SimulationTrace identifiers and SHALL NOT become the canonical trace itself.

### Requirement: Simulation tool outputs preserve provenance
Simulation tool outputs SHALL preserve whether a run is standalone, course-launched, Arena preview, official evaluation, teacher batch, or agent experiment.

#### Scenario: Preview run is analyzed
- **WHEN** Konling analyzes a preview-only run
- **THEN** the output SHALL identify it as preview-only and SHALL NOT present it as official evaluation evidence.
