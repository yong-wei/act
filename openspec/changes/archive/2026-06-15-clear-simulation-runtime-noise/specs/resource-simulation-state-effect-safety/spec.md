## ADDED Requirements

### Requirement: Simulation detail routes are free of shared page errors
Simulation detail routes SHALL render without the shared `classList` null page error observed in the 2026-06-15 audit.

#### Scenario: Simulation detail route is captured
- **WHEN** local browser QA opens any active `/simulations/*` detail route
- **THEN** the browser page-error log SHALL NOT contain `Cannot read properties of null (reading 'classList')`
- **AND** any replacement defensive logic SHALL preserve the intended shell, theme, dock, panel, and local-tool behavior.

### Requirement: Simulation Three.js integration avoids known deprecated APIs
Simulation rendering integration SHALL avoid known Three.js API usage that produces deprecation warnings in the current runtime baseline.

#### Scenario: Simulation detail route renders a 3D scene
- **WHEN** local browser QA opens a simulation detail route with a Three.js scene
- **THEN** the console log SHALL NOT contain `THREE.Clock: This module has been deprecated`
- **AND** the console log SHALL NOT contain `THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated`
- **AND** the replacement timing and shadow behavior SHALL preserve visible scene rendering and interaction.

### Requirement: Runtime-noise fixes preserve simulation state semantics
Runtime-noise cleanup SHALL NOT change simulation state update semantics, control inputs, telemetry summaries, or evidence recording.

#### Scenario: Runtime-noise cleanup is reviewed
- **WHEN** a simulation page is updated to remove page errors or deprecation warnings
- **THEN** tests or reviewer evidence SHALL confirm that controller inputs, pause/start/reset behavior, telemetry display, and trace/evidence boundaries remain functionally equivalent.
