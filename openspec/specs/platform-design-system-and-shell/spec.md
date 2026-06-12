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

### Requirement: Primary routes declare a registered experience archetype
The platform SHALL classify every primary UI route under a registered experience archetype before migration is accepted.

#### Scenario: Route shell is changed
- **WHEN** a primary route changes header, shell, layout, navigation, floating controls, first viewport, or theme treatment
- **THEN** the route SHALL declare one of `public-entry`, `learning-atlas`, `mission-workspace`, `knowledge-data-map`, `operations-console`, or `report-ledger`
- **AND** the implementation SHALL follow that archetype's navigation layers, information density, mobile behavior, and theme template rules.

### Requirement: Canonical archetype names are the implementation vocabulary
The platform SHALL use the redesigned archetype names as the canonical vocabulary for route inventory, visual QA manifests, governance rules, and migration ledgers.

#### Scenario: Existing route-frame names remain in code
- **WHEN** legacy names such as `learning-map`, `immersive-task-workspace`, `learner-data`, `teacher-operations`, `admin-governance`, or `knowledge-graph` remain during migration
- **THEN** they SHALL be registered as temporary aliases of `learning-atlas`, `mission-workspace`, `knowledge-data-map`, `operations-console`, or `report-ledger`
- **AND** the ledger SHALL name the owning change and retirement condition for every alias.

### Requirement: Route families are registered under archetypes
The platform SHALL register primary route families under the canonical archetypes before page-family migrations are accepted.

#### Scenario: Route family inventory is reviewed
- **WHEN** the platform redesign inventory is reviewed
- **THEN** `public-entry` SHALL govern homepage, login, and public learning entry routes
- **AND** `learning-atlas` SHALL govern Interactive Learning, course catalog, adaptive entry, and student path overview routes
- **AND** `mission-workspace` SHALL govern Control Workbench, Arena task detail, simulations, and interactive runtime routes
- **AND** `knowledge-data-map` SHALL govern knowledge graph, data center, evidence browser, and learner record routes
- **AND** `operations-console` SHALL govern teacher and administrator workflow routes
- **AND** `report-ledger` SHALL govern teacher reports, governance snapshots, and exported review surfaces.

### Requirement: Incompatible legacy shells may be replaced
The platform SHALL allow legacy shell components to be removed when adapting them would preserve incompatible hierarchy or page-local navigation.

#### Scenario: Legacy shell conflicts with archetype rules
- **WHEN** `FeaturePageNav`, `UnifiedTopBar`, `ArenaPageShell`, teacher/admin headers, premium lesson shells, or page-local fixed controls conflict with the target archetype
- **THEN** the migration SHALL replace or retire the legacy shell rather than visually restyling it in place
- **AND** route behavior, auth callback behavior, contextual return targets, and role actions SHALL remain intact.

### Requirement: Route archetypes own shell conformance rules
The platform SHALL define shell conformance rules for every registered route archetype.

#### Scenario: A primary route adopts an archetype
- **WHEN** a route declares `public-entry`, `learning-atlas`, `mission-workspace`, `knowledge-data-map`, `operations-console`, or `report-ledger`
- **THEN** the route shell SHALL match that archetype's first-viewport purpose, navigation-layer emphasis, panel density, local tool placement, mobile collapse behavior, and light/dark template behavior
- **AND** the route SHALL NOT use a generic card-page shell when the archetype calls for an entry surface, atlas, workspace, data map, console, or ledger structure.

#### Scenario: Archetype shell expectations are reviewed
- **WHEN** shell conformance is reviewed for a migrated route
- **THEN** `public-entry` SHALL prioritize orientation and role entry, `learning-atlas` SHALL prioritize path discovery, `mission-workspace` SHALL prioritize task execution and local tools, `knowledge-data-map` SHALL prioritize graph/data relationships, `operations-console` SHALL prioritize repeated operator workflows, and `report-ledger` SHALL prioritize evidence, status, and export readiness.

### Requirement: Dual theme templates expose complete token roles
The design system SHALL expose complete token roles for both light and dark commercial templates.

#### Scenario: A primary surface uses theme tokens
- **WHEN** a public, learning, workspace, knowledge, data, teacher, admin, or report surface renders
- **THEN** it SHALL use governed token roles for canvas, surface-1, surface-2, elevated, hairline, trace accent, muted accent, danger, success, focus ring, evidence, and report output
- **AND** it SHALL NOT use undocumented Tailwind color families or raw gradients as a replacement for those roles.

### Requirement: Dual templates are structurally distinct commercial modes
The design system SHALL treat light and dark as two first-class commercial templates rather than a color inversion of the same card layout.

#### Scenario: Theme parity is reviewed
- **WHEN** a route is accepted in both light and dark themes
- **THEN** the light template SHALL express engineering chart paper, daylight instrument surfaces, readable traces, and matte evidence layers
- **AND** the dark template SHALL express night bridge canvas, low-light instruments, controlled trace illumination, and signal status layers.

### Requirement: Page-local accent palettes are prohibited on representative routes
Representative commercial routes SHALL not introduce unmanaged page-local accent palettes during redesign.

#### Scenario: Representative route is changed
- **WHEN** a representative route adds visual classes, gradients, badges, charts, or status colors
- **THEN** raw accent families such as `slate`, `cyan`, `amber`, `violet`, `fuchsia`, or route-local gradients SHALL be mapped to approved token roles
- **AND** commercial UI governance SHALL reject silent reintroduction of local palettes.

### Requirement: Legacy visual namespaces have explicit mapping or retirement
The design system SHALL track whether legacy visual namespaces map to the dual templates or must be retired.

#### Scenario: Legacy namespace is encountered
- **WHEN** `interactive-course-hub-*`, `admin-console-*`, `premium-lesson-*`, `surface-card`, or page-local visual classes are touched during redesign
- **THEN** the change SHALL map them to approved token roles or mark them for retirement
- **AND** silent long-term coexistence SHALL be rejected.

### Requirement: Shell migration ledger tracks legacy retirement
The design system SHALL maintain a migration ledger for shell adoption and legacy shell retirement.

#### Scenario: Legacy shell is retained during redesign
- **WHEN** a route keeps a legacy shell, topbar, sidebar, breadcrumb, or fixed-control system
- **THEN** the ledger SHALL record whether it is adapted, retained temporarily, or scheduled for replacement
- **AND** it SHALL name the owning change and removal condition.

### Requirement: Platform shell owns navigation frame rendering
The platform shell SHALL own rendering of global orientation, role cockpit actions, contextual route trace, and local tool slots.

#### Scenario: Legacy shell remains
- **WHEN** a route still uses `UnifiedTopBar`, `ArenaPageShell`, teacher layout, admin console header, or another legacy shell
- **THEN** the route inventory SHALL mark that shell as adapted, retained, or scheduled for retirement
- **AND** undocumented shell duplication SHALL fail governance.

### Requirement: Mobile AppShell provides equivalent navigation access
The platform shell SHALL provide mobile access that is equivalent to the desktop route family navigation.

#### Scenario: AppShell renders below the mobile breakpoint
- **WHEN** a route exposes more navigation destinations than can fit comfortably in the first viewport
- **THEN** the shell SHALL provide drawer, sheet, command, or tab access rather than horizontal-scroll-only navigation
- **AND** the current route, parent route, and return target SHALL remain visible.

### Requirement: Floating controls use one dock information architecture
The platform shell SHALL expose one dock model for Konling, management, and settings controls.

#### Scenario: Fixed controls render
- **WHEN** AI assistant, settings, management, or page-local floating controls are available
- **THEN** they SHALL register with the shared dock model
- **AND** separate right-bottom fixed systems SHALL NOT render concurrently outside the dock.

#### Scenario: Dock renders over a task workspace
- **WHEN** Konling, page tools, settings, management controls, issue badges, or support drawers are visible
- **THEN** the dock SHALL prove safe-area, z-index, keyboard reachability, and collision behavior at 1440px and 320px
- **AND** the dock SHALL NOT obscure primary task controls, graph canvases, forms, charts, or report labels.

### Requirement: Shell migration ownership is declared before implementation
The platform design system SHALL require primary shell migrations to be owned through the central route ledger before route components are changed.

#### Scenario: AppShell migration begins
- **WHEN** a primary route is prepared for AppShell, workspace shell, or local shell retirement work
- **THEN** the route ledger SHALL identify archetype, owning change, legacy shell disposition, theme support, dock behavior, and visual QA profile
- **AND** the implementation SHALL not create page-local shell ownership outside the ledger.
