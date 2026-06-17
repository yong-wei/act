## ADDED Requirements

### Requirement: Adaptive path center isolates route-intent workspaces
The adaptive learning center SHALL render one primary workspace per route intent.

#### Scenario: Landing intent is opened
- **WHEN** a student opens `/assessment/adaptive-practice` without an intent
- **THEN** the page SHALL prioritize continuing the current path, generating a new path, or reviewing evidence
- **AND** it SHALL NOT render unselectable preset goals or all downstream states as the main scroll content.

#### Scenario: Path execution intent is opened
- **WHEN** a student opens `intent=path-execution` with a path id
- **THEN** the page SHALL render the selected path map, current node, node detail, and evidence summary as the primary workspace
- **AND** the generation panel SHALL be closed unless the student explicitly opens an adjustment action.

#### Scenario: Evidence review intent is opened
- **WHEN** a student opens `intent=evidence-review` with a path id
- **THEN** the page SHALL render path completion overview, timeline, selection or adjustment history, node results, Konling interventions, skip and return records, and evidence labels as the primary workspace.

### Requirement: Adaptive path center preserves path context across states
The adaptive learning center SHALL preserve selected path context while students move between generation, selection, execution, launched resources, and evidence review.

#### Scenario: Student selects a generated option
- **WHEN** the student selects a path option
- **THEN** the generation panel SHALL close
- **AND** the route SHALL enter path execution with the selected path id, selected option, current node, and alternatives available for later switching or review.

#### Scenario: Student returns from a resource
- **WHEN** a launched knowledge, exercise, simulation, workbench, Arena, or Konling activity returns to the path center
- **THEN** the same path id, node id, goal id, and route intent SHALL be restored unless the path was explicitly recalculated.

### Requirement: Adaptive path states use task-first responsive layouts
The adaptive path center SHALL provide desktop and mobile layouts tailored to each primary workspace.

#### Scenario: Desktop state renders
- **WHEN** landing, generation, selection, execution, or evidence review renders on desktop
- **THEN** the primary workspace SHALL use AppShell space with stable regions and no nested page-card layout.

#### Scenario: Mobile state renders
- **WHEN** landing, generation, selection, execution, or evidence review renders at 320px width
- **THEN** the UI SHALL use task-first panels, tabs, sheets, or vertical comparison sections
- **AND** controls and text SHALL not overlap or require desktop multi-column scanning.
