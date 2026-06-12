## ADDED Requirements

### Requirement: AppShell renders canonical archetype variants
The shared AppShell SHALL render primary route frames from canonical archetype metadata rather than page-local shell decisions.

#### Scenario: Route enters AppShell
- **WHEN** a primary route declares `public-entry`, `learning-atlas`, `mission-workspace`, `knowledge-data-map`, `operations-console`, or `report-ledger`
- **THEN** AppShell SHALL select the matching frame variant, navigation layer emphasis, theme template, dock behavior, and responsive shell structure
- **AND** page components SHALL not duplicate the global frame inside feature content.

### Requirement: AppShell remains domain-agnostic
The shared AppShell SHALL receive navigation, status, evidence, support, and action data through contracts or props without importing feature orchestration modules.

#### Scenario: Feature data appears in shell slots
- **WHEN** Arena, Control Workbench, adaptive learning, learner record, teacher, admin, or report data is displayed in AppShell slots
- **THEN** the feature domain SHALL supply the DTO or slot content
- **AND** AppShell SHALL own only layout, navigation, tone, accessibility, and shell interaction behavior.

### Requirement: Platform dock is shell-owned
The platform shell SHALL own global floating dock rendering for Konling, management, settings, support, and related shell-level controls.

#### Scenario: Primary route exposes floating controls
- **WHEN** a migrated primary route renders shell-level controls
- **THEN** the controls SHALL use the shared dock with consistent placement, focus order, z-index, theme treatment, and responsive collapse behavior
- **AND** page-local fixed controls SHALL be retired or registered as temporary adapters with removal conditions.
