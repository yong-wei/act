## MODIFIED Requirements

### Requirement: Route inventory governs shell and navigation decisions
The system SHALL maintain an inventory of representative routes and their expected shell, navigation layers, role scope, and floating dock behavior.

#### Scenario: A route changes shell or navigation
- **WHEN** a primary route changes its header, sidebar, breadcrumb, cockpit action, contextual return action, or floating dock behavior
- **THEN** the change SHALL update or satisfy the route inventory
- **AND** route aliases and authentication callback destinations SHALL remain compatible.

#### Scenario: Simulation detail route is inventoried
- **WHEN** a `/simulations/*` detail route adopts `SimulationShell`
- **THEN** the route inventory SHALL register it as a `mission-workspace` route with contextual return to `/simulations`
- **AND** migrated simulation detail pages SHALL NOT retain a `FeaturePageNav` legacy shell disposition.
