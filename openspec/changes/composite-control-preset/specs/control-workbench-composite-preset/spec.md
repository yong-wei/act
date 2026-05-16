## ADDED Requirements

### Requirement: Composite tasks render a dedicated workbench preset
The unified control workbench SHALL provide a composite-control preset for Arena tasks whose workspace mode is `block-diagram-workbench`.

#### Scenario: Third-order block-diagram challenge opens composite preset
- **WHEN** a student opens the unified workbench for `task-third-order-block-diagram`
- **THEN** the workbench SHALL render a composite-control method panel
- **AND** it SHALL NOT require entering the lesson-05 module list.

### Requirement: Composite method panel exposes bounded template parameters
The composite preset SHALL expose a bounded first-version template for structural compensation.

#### Scenario: Student edits composite parameters
- **WHEN** the student edits prefilter gain, feedforward gain, local feedback gain, or disturbance compensation
- **THEN** the current controller draft SHALL update
- **AND** the visible structure summary SHALL reflect the same values.

### Requirement: Composite preset generates official artifacts
The composite preset SHALL generate a `composite-compensation` `ControllerArtifact` for official evaluation.

#### Scenario: Student submits composite controller
- **WHEN** the student submits a valid composite draft
- **THEN** the workbench SHALL call `/api/arena/evaluate`
- **AND** the artifact method SHALL be `composite-compensation`.

### Requirement: Composite views match available signals
The composite preset SHALL default to views that represent response, control effort, error or disturbance, and structure summary.

#### Scenario: Composite preset loads
- **WHEN** the composite preset opens
- **THEN** it SHALL render a layout for time response, control signal or effort, error/disturbance summary, and metrics or structure summary.
