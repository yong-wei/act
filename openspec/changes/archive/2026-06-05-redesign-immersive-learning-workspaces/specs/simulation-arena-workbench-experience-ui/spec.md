## ADDED Requirements

### Requirement: Simulation, Arena, and Workbench share mission navigation
Simulation, Arena, and Control Workbench routes SHALL share mission-workspace navigation and return-target behavior.

#### Scenario: User moves from Arena to Workbench
- **WHEN** a user enters a workbench from Arena or simulation context
- **THEN** the mission workspace SHALL preserve launch provenance, contextual return target, official/preview state, and task identity
- **AND** the visual shell SHALL remain consistent with other mission workspaces.

### Requirement: Mission workspace completion connects to learner evidence
Simulation, Arena, Workbench, and lesson runtime workspaces SHALL expose evidence flow after task completion.

#### Scenario: User completes or submits a mission workspace task
- **WHEN** a task submission, simulation completion, Arena official/preview result, or lesson activity submission is recorded
- **THEN** the workspace SHALL show how the result contributes to evidence rail, learner record, or next recommendation where available
- **AND** missing evidence instrumentation SHALL be represented as an honest unavailable or preview state.

### Requirement: Workspace visual evidence includes nonblank instrument checks
Mission workspace visual QA SHALL verify that the primary instrument area is visible and nonblank.

#### Scenario: Workspace screenshots are captured
- **WHEN** visual evidence is collected for a mission workspace
- **THEN** the evidence SHALL show nonblank chart, canvas, graph, simulation, or instrument placeholder state
- **AND** it SHALL show that dock controls and local toolbars do not overlap the primary task.
