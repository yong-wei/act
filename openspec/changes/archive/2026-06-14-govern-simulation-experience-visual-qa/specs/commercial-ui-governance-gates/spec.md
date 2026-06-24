## ADDED Requirements

### Requirement: Simulation visual QA matrix is required
Commercial UI governance SHALL require structured visual evidence for virtual simulation catalog, compatibility route, representative detail pages, and related mission workspaces.

#### Scenario: Simulation UI migration is reviewed
- **WHEN** a PR changes `/simulations`, `/virtual-lab`, `/simulations/*`, or simulation-related mission shell behavior
- **THEN** evidence SHALL include `/simulations`, the final `/virtual-lab` behavior, at least one heading-control simulation, at least one DP/positioning simulation, `/simulations/cruise`, and `/interactive-learning/control-workbench` regression coverage
- **AND** evidence SHALL include light theme, dark theme, desktop navigation states, 320px mobile behavior, dock state, local-tool state, and first-viewport task visibility where applicable.

### Requirement: Simulation evidence proves nonblank mission workspace
Simulation visual evidence SHALL prove that the primary scene, chart, canvas, or instrument area is visible and nonblank.

#### Scenario: Simulation screenshot is captured
- **WHEN** visual evidence is captured for a simulation detail route
- **THEN** the evidence SHALL show a nonblank primary simulation or instrument area
- **AND** it SHALL show that bottom toolbar, side panels, hints, and shared dock do not overlap primary controls or obscure the scene.

### Requirement: Simulation information architecture regressions are governed
Commercial UI governance SHALL reject simulation routes that reintroduce conflicting availability truth or internal model-status language for students.

#### Scenario: Simulation entry route is checked
- **WHEN** governance checks student-facing simulation entry routes
- **THEN** `/virtual-lab` SHALL NOT display an availability count that conflicts with `/simulations`
- **AND** student-facing catalog surfaces SHALL NOT show internal model deployment or version status as primary learning information.

### Requirement: Simulation assistant and local controls use one dock model
Commercial UI governance SHALL reject duplicate assistant systems and unmanaged right-bottom fixed controls on simulation routes.

#### Scenario: Simulation route exposes assistant support
- **WHEN** Konling or assistant support is available on a simulation route
- **THEN** it SHALL be registered through the shared dock model
- **AND** duplicate page-local assistant panels, unmanaged settings buttons, or separate right-bottom fixed control systems SHALL fail governance after migration.

### Requirement: Simulation React Doctor checks remain local
Simulation UI governance SHALL support local-only React Doctor error-level checks for affected simulation routes.

#### Scenario: Simulation UI is validated locally
- **WHEN** a developer validates simulation UI changes
- **THEN** local checks SHALL report React Doctor error-level findings for the affected simulation route set where feasible
- **AND** the project SHALL NOT add GitHub Actions integration for this check unless CI quota constraints are explicitly changed.
