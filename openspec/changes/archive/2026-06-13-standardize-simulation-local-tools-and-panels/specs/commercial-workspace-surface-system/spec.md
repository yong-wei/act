## MODIFIED Requirements

### Requirement: Dense workspace controls do not compete with shell controls

Commercial workspace local controls SHALL be visually distinct from role cockpit, global navigation, and floating dock controls.

#### Scenario: Simulation pages expose local tools as workspace controls
- **WHEN** a simulation detail route renders local telemetry, controls, hints, or scene commands
- **THEN** the controls SHALL be organized as simulation-local workspace panels and bottom tools
- **AND** mobile secondary controls SHALL NOT appear as persistent sidebars that compete with the primary scene
- **AND** the local tool layer SHALL use governed platform tokens rather than page-local palettes.
