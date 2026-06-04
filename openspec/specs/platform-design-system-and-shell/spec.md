## Purpose
Define the platform UI foundation for semantic design tokens, shared role-aware shell primitives, navigation contracts, migration adapters, and ownership guardrails used by future product surfaces.
## Requirements
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

### Requirement: Commercial shells may retire legacy shells
The system SHALL allow legacy shell components to be removed when a commercial shell replacement preserves route access, role actions, and contextual navigation.

#### Scenario: A legacy shell conflicts with the new hierarchy
- **WHEN** `UnifiedTopBar`, `ArenaPageShell`, teacher layout, admin header, or another legacy shell duplicates navigation or creates inconsistent visual hierarchy
- **THEN** the migration MAY replace it with a commercial shell instead of adapting its visual styling in place.

### Requirement: Workspace shells are derived from shared brand tokens
The system SHALL allow specialized workspace shells for dense tools while requiring them to inherit commercial brand tokens, typography, status colors, and account/cockpit conventions.

#### Scenario: A dense tool renders
- **WHEN** Arena, Control Workbench, adaptive practice, teacher analytics, or admin governance renders a workspace shell
- **THEN** the shell SHALL use shared brand primitives for canvas, panels, instruments, status, navigation, and user actions.

### Requirement: Platform token use is enforceable
The system SHALL provide source-level checks that enforce approved platform and commercial brand token usage for new or migrated UI surfaces.

#### Scenario: New UI bypasses approved tokens
- **WHEN** a new or migrated page, shell, panel, or shared component introduces direct visual styling that duplicates platform token roles
- **THEN** the check SHALL fail or report the bypass according to governance mode
- **AND** the code SHALL either use approved tokens or register a justified design-system addition.

### Requirement: Shell retirement is tracked by route inventory
The system SHALL maintain a route and shell inventory for primary platform surfaces and track legacy-shell retirement through migration references.

#### Scenario: A legacy shell remains after commercial migration
- **WHEN** a migrated route still uses a legacy shell component
- **THEN** the inventory SHALL identify whether that shell is intentionally retained, adapted, or scheduled for removal
- **AND** undocumented shell duplication SHALL fail or be reported by governance mode.

### Requirement: Platform shell owns the floating action dock
The platform shell SHALL provide a shared floating action dock for Konling, management, and settings controls.

#### Scenario: A primary route renders floating controls
- **WHEN** a public, student, teacher, admin, immersive workspace, or knowledge graph route exposes Konling or management/settings controls
- **THEN** the controls SHALL render through the shared dock with consistent bottom/right offsets, spacing, hit target size, z-index, theme treatment, and responsive collapse behavior
- **AND** page-local fixed buttons SHALL NOT compete with or overlap the shared dock.

#### Scenario: Dock controls are not available
- **WHEN** Konling, management, or settings controls are hidden by role, feature flag, or workspace mode
- **THEN** the dock SHALL preserve layout rules without leaving orphan spacing or unreachable focus targets.

### Requirement: Platform shell supports premium route frames
The platform shell SHALL support route frames for public entry, learning map, immersive task workspace, learner data, teacher operations, admin governance, and knowledge graph contexts.

#### Scenario: A primary route is migrated
- **WHEN** a primary route adopts the premium shell
- **THEN** it SHALL declare its route frame type, role scope, contextual navigation, account action semantics, and floating dock behavior through shared shell contracts
- **AND** it SHALL avoid duplicating the global page frame inside feature components.
