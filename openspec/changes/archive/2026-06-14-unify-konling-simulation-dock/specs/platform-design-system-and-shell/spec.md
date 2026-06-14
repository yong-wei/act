## ADDED Requirements

### Requirement: Simulation pages use the shared floating dock
Simulation catalog, detail, and mission pages SHALL expose Konling and related shell-level floating controls through the shared platform dock.

#### Scenario: Konling is available on a simulation page
- **WHEN** Konling is enabled on `/simulations` or a `/simulations/*` route
- **THEN** the assistant SHALL render through the shared dock model
- **AND** page-local duplicate assistant regions or separate right-bottom fixed systems SHALL NOT render concurrently.

### Requirement: Simulation dock avoids local controls
The shared dock SHALL avoid collisions with simulation bottom toolbars, hint strips, side panels, and primary scenes.

#### Scenario: Assistant expands in simulation workspace
- **WHEN** the user expands Konling in a simulation mission workspace
- **THEN** the expanded assistant SHALL remain keyboard reachable and readable
- **AND** it SHALL NOT obscure primary run controls, scene interaction, or required evaluation controls.
