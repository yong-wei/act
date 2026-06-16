## ADDED Requirements

### Requirement: Command-deck contract applies to all active simulation details
The command-deck visual and interaction contract SHALL apply to every active `/simulations/*` detail route, not only representative pilot routes.

#### Scenario: Active simulation route is opened
- **WHEN** a user opens any active simulation detail route
- **THEN** the route SHALL provide scene-first layout, top shell context, top-aligned side panels, bottom local toolbar, shared Konling dock, light/dark template parity, and mobile-reachable local controls
- **AND** the route SHALL NOT rely on an undocumented route-specific shell geometry.

### Requirement: New simulation details enter the full visual matrix
New simulation detail routes SHALL be added to the full visual QA matrix when they become active.

#### Scenario: New simulation route is registered
- **WHEN** a new active simulation detail route is added to the simulation catalog or route registry
- **THEN** the full simulation visual QA matrix SHALL include the new route in desktop/mobile and light/dark themes
- **AND** the route SHALL identify its local panel template and scene theme parameter set.
