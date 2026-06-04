## ADDED Requirements

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
