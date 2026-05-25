## ADDED Requirements

### Requirement: Platform UI tokens are semantic and reusable
The system SHALL define platform UI tokens for page canvas, surface levels, foreground text, borders, action states, evidence state, privacy state, replay state, and evaluation state.

#### Scenario: New product UI is built
- **WHEN** a new product page, role page, shell, panel, card, or status component is introduced
- **THEN** it SHALL use platform semantic tokens or approved primitive variants rather than page-local hex palettes or untracked color families.

### Requirement: AppShell owns global page frame
The system SHALL provide a shared `AppShell` contract for role-aware page framing, global header, responsive navigation, breadcrumbs, user actions, theme switching, and page action slots.

#### Scenario: Role page renders inside shell
- **WHEN** a student, teacher, or admin page uses the platform shell
- **THEN** the page SHALL receive role navigation, cockpit routing, theme state, breadcrumbs, and action slots through shared shell contracts.

### Requirement: UI primitives preserve platform ownership boundaries
The system SHALL keep shared UI primitives presentation-focused and SHALL NOT move course, ResourceNode, Arena, simulation, adaptive, or governance business orchestration into `src/components`.

#### Scenario: Feature surface uses shared primitives
- **WHEN** a feature surface renders with `AppShell`, shared surface primitives, navigation renderers, or status components
- **THEN** those primitives SHALL receive role, navigation, status, and action data through props or adapter contracts
- **AND** business orchestration SHALL remain in `src/features/**`, resource implementations SHALL remain in `src/resources/**`, and course-resource resolution SHALL remain registry- or lesson-engine-owned.

### Requirement: Legacy shell components migrate through adapters
The system SHALL allow existing shell components to migrate incrementally through adapters before removal.

#### Scenario: Existing module migrates
- **WHEN** an existing module currently using `FeaturePageNav`, `UnifiedTopBar`, `ArenaPageShell`, teacher layout, or admin header is migrated
- **THEN** the module SHALL preserve its current route behavior while delegating shared visual shell responsibilities to platform primitives.

### Requirement: Unified shell remains rollback-safe
The system SHALL keep legacy surfaces available while unified shell migration is guarded by feature flags.

#### Scenario: Unified shell flag is disabled
- **WHEN** the unified shell feature flag is disabled
- **THEN** affected pages SHALL continue to expose the previous navigation and user action paths without losing access to role cockpits or module entries.
