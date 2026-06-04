## ADDED Requirements

### Requirement: Task workspaces use registered archetypes
Commercial workspaces SHALL support registered archetypes for immersive scene, engineering analysis, challenge task, lesson runtime, learner data, operations analytics, and governance console surfaces.

#### Scenario: A task route is migrated
- **WHEN** a simulation, Control Workbench, Arena, or interactive runtime route adopts a commercial workspace
- **THEN** it SHALL declare its workspace archetype and expected zones
- **AND** it SHALL inherit platform tokens, navigation conventions, account actions, and floating dock rules.

### Requirement: Dense workspace controls do not compete with shell controls
Commercial workspace local controls SHALL be visually distinct from role cockpit, global navigation, and floating dock controls.

#### Scenario: A workspace has local tools and shell actions
- **WHEN** camera tools, chart toggles, parameter controls, Konling, and settings are all available
- **THEN** their location and priority SHALL make task-local tools distinct from shell-level floating controls
- **AND** keyboard focus order SHALL remain coherent.
