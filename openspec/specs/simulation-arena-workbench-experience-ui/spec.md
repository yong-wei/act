## Purpose

Define the shared display shell and workflow UI contracts for Simulation Hub, simulation scenes, Arena pages, challenge detail, course-launched resources, and Control Workbench sessions while preserving the feature domains that own physics, scoring, replay, evidence, and lesson runtime behavior.
## Requirements
### Requirement: Simulation, Arena, and Workbench share an experience shell
The system SHALL provide a consistent experience shell for Simulation Hub, simulation scenes, Arena pages, challenge detail, and Control Workbench sessions.

#### Scenario: Student moves from Arena challenge to Workbench
- **WHEN** a student opens an Arena challenge and launches the Control Workbench
- **THEN** the shell SHALL preserve challenge context, breadcrumb lineage, task identity, and return navigation.

### Requirement: Launch provenance is visible
The system SHALL display whether a simulation or workbench activity is standalone, course-launched, Arena preview, or official evaluation.

#### Scenario: Course launches a simulation
- **WHEN** a simulation is launched from a DB BOPPPS lesson item
- **THEN** the UI SHALL identify course/class/session context where available and keep standalone provenance visually distinct.

### Requirement: Course-launched experiences preserve lesson runtime contracts
The system SHALL preserve the DB BOPPPS lesson-engine chain when simulation, Arena, or Workbench experiences are launched from course resources.

#### Scenario: Lesson item launches an interactive experience
- **WHEN** a DB BOPPPS `LessonItem` launches a simulation, Arena task, or Workbench-compatible resource
- **THEN** the UI SHALL keep resource resolution registry-driven and preserve `ResourceRenderer`, `InteractiveProvider`, embedded progress callbacks, and `BaseWidgetProps` behavior where applicable
- **AND** config resolution SHALL continue to follow registry default config, then `TeachingResource.config`, then `LessonItem.overrideConfig`.

### Requirement: Official and preview evaluation boundaries are explicit
The system SHALL distinguish public experiments, virtual previews, official submissions, and hidden official evaluation results.

#### Scenario: Preview result is shown
- **WHEN** a virtual preview trace or public experiment result is displayed
- **THEN** the UI SHALL NOT present it as official leaderboard evidence and SHALL identify its preview provenance.

### Requirement: Replay and trace state has a shared display
The system SHALL expose trace summary, replay checksum state, protocol version, and model/runtime version through shared status UI where the backing contracts provide those fields.

#### Scenario: Replay verification is available
- **WHEN** a trace or run has replay metadata
- **THEN** the UI SHALL show whether replay verification is available, pending, verified, mismatched, or restricted by role scope.

### Requirement: Immersive task workspaces preserve scene primacy
The system SHALL render simulation scenes and compatible immersive tasks with the primary scene or experiment canvas as the visual center.

#### Scenario: Simulation scene renders
- **WHEN** a simulation scene opens
- **THEN** the 3D or experiment canvas SHALL remain central and visually primary
- **AND** status, controls, camera tools, provenance, and support controls SHALL use shared workspace rails or overlays without obscuring the primary task.

### Requirement: Engineering workspaces use analysis-first hierarchy
The system SHALL render Control Workbench and compatible engineering tasks with step flow, parameter controls, chart canvas, result state, and evidence/status context in stable zones.

#### Scenario: Control Workbench renders
- **WHEN** the workbench displays response, Bode, root-locus, Nyquist, or equivalent panels
- **THEN** chart panels SHALL keep stable geometry
- **AND** design flow, current step, next action, and evidence limitations SHALL be visible without relying on many unrelated same-weight cards.

### Requirement: Task workspaces preserve launch provenance
The system SHALL display whether a task workspace is standalone, course-launched, Arena preview, official evaluation, teacher review, or admin review.

#### Scenario: Task opens from a source context
- **WHEN** a user opens a simulation, workbench, Arena task, or interactive runtime task from another route
- **THEN** the workspace SHALL preserve source context, return target, role scope, and official/preview status where available.

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

### Requirement: Arena and Control Workbench share mission route continuity
Arena and Control Workbench UI SHALL preserve route continuity through the unified mission shell.

#### Scenario: Control Workbench opens from Arena context
- **WHEN** a student opens Control Workbench from an Arena challenge or publication context
- **THEN** the unified shell SHALL display the Arena-derived route trace or return target
- **AND** returning from the workbench SHALL target the originating Arena context rather than a generic entry page.

#### Scenario: Control Workbench opens directly
- **WHEN** a student opens Control Workbench directly
- **THEN** the unified shell SHALL show the default mission context, object selection, and primary instrument area without requiring Arena context.
