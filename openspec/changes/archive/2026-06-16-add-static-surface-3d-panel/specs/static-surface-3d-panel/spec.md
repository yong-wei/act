## ADDED Requirements

### Requirement: Static 3D surface panels render precomputed surface data
The system SHALL provide a shared frontend panel that renders precomputed 3D surface data for interactive course `compute.panel` modules.

#### Scenario: Surface panel receives mesh data
- **WHEN** a runtime manifest module declares the `static-surface-3d` compute capability with valid precomputed surface data or a valid data asset reference
- **THEN** the runtime SHALL render a 3D surface with the declared axis labels, color scale, teaching title, and caption
- **AND** it SHALL NOT require Rust/WASM computation to display the surface.

#### Scenario: Surface data is unavailable
- **WHEN** the referenced surface data cannot be loaded or parsed
- **THEN** the panel SHALL render a teaching-semantic unavailable state and static fallback evidence when configured
- **AND** it SHALL NOT render a blank canvas as the only visible output.

### Requirement: Static 3D surface panels support classroom inspection controls
The system SHALL let students and teachers inspect a static 3D surface through camera controls without changing the underlying data.

#### Scenario: User inspects the surface
- **WHEN** the static 3D surface panel is visible
- **THEN** users SHALL be able to rotate and zoom the camera
- **AND** the panel SHALL expose a reset-view control that restores the authored default camera.

#### Scenario: Surface contains pole markers
- **WHEN** the payload declares pole markers or other teaching markers
- **THEN** the panel SHALL render those markers in the correct surface coordinate space
- **AND** marker labels SHALL use teaching-semantic text rather than implementation identifiers.

### Requirement: Static 3D surface panels remain bounded and accessible
The system SHALL keep the static 3D surface viewer usable inside an interactive lesson page.

#### Scenario: Panel renders in a lesson layout
- **WHEN** the panel renders inside a lesson step
- **THEN** it SHALL use stable responsive dimensions and bounded device-pixel ratio
- **AND** it SHALL avoid resizing the surrounding lesson layout during normal camera interaction.

#### Scenario: Assistive or low-capability context is used
- **WHEN** WebGL is unavailable or a nonvisual user needs the teaching meaning
- **THEN** the panel SHALL expose configured fallback image, caption, or text describing the observable surface evidence.
