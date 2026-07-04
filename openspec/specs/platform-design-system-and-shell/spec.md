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

### Requirement: Descendant pages inherit approved shell frames
The platform shell system SHALL require first-hop and descendant product pages to render through `AppShell`, an approved workspace shell, or a registered temporary exception with a removal condition.

#### Scenario: User follows a first-hop page action
- **WHEN** a user opens a primary action from Interactive Learning, Arena, Control Workbench, knowledge graph, data center, simulation, teacher, admin, or report routes
- **THEN** the destination SHALL preserve the approved shell frame, role label, contextual route trace, theme controls, and mobile navigation model
- **AND** the destination SHALL NOT replace the shell with an unregistered page-local topbar, sidebar, breadcrumb, or fixed header.

#### Scenario: Descendant route cannot migrate immediately
- **WHEN** a descendant route must keep a runtime-specific shell during migration
- **THEN** the route SHALL declare the approved shell disposition, owner, affected capability, expiry, and removal condition in the route ledger
- **AND** visual governance SHALL treat the route as an exception rather than an untracked success.

### Requirement: Content width follows route archetype
Route frames SHALL define whether page content is reading-width, atlas-width, or fluid workspace-width rather than relying on page-local full-page `max-w` containers.

#### Scenario: Collapsible navigation changes width
- **WHEN** AppShell navigation collapses on a learning, mission, knowledge, data, teacher, admin, or report route
- **THEN** the primary workspace region SHALL expand according to the route archetype
- **AND** any narrow reading constraint SHALL apply only to text-heavy inner blocks, not to the full route canvas.

### Requirement: Local tools use shell-compatible collapse behavior
Feature-owned local tools SHALL render in shell-compatible slots, panels, drawers, or collapsible overlays instead of permanent unregistered overlays.

#### Scenario: Workspace local tools are present
- **WHEN** filters, legends, directories, view switches, resource panels, evidence panels, or runtime controls render on a migrated route
- **THEN** those controls SHALL expose open, closed, and mobile states that do not overlap global navigation, page actions, or the floating dock
- **AND** their visible state SHALL be testable through DOM metadata or visual evidence.

### Requirement: Simulation shell chrome uses governed theme roles
Simulation mission workspace chrome SHALL use platform semantic tokens for translucent top bars, side panels, bottom toolbars, hints, borders, text, and action states.

#### Scenario: Simulation shell theme changes
- **WHEN** the user switches between light and dark theme on a simulation route
- **THEN** shell chrome SHALL switch through governed theme roles
- **AND** it SHALL preserve readable text, visible focus, and clear panel boundaries without page-local raw color systems.

### Requirement: Simulation scene and shell colors are separated
Simulation shells SHALL allow feature-owned scene colors while governing UI chrome through platform tokens.

#### Scenario: Scene renders under shell chrome
- **WHEN** a 3D scene uses natural water, ship, terrain, or grid colors
- **THEN** the scene MAY keep feature-owned visual colors
- **AND** surrounding navigation, panels, toolbar, buttons, labels, and status UI SHALL use platform theme roles.

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

### Requirement: AppShell desktop navigation defaults to collapsed and persists user preference
The shared AppShell SHALL default eligible desktop navigation to the collapsed rail and persist the user's explicit expanded or collapsed preference across platform pages.

#### Scenario: User opens an eligible desktop route without a stored preference
- **WHEN** a user opens a primary workspace route such as `/knowledge`, `/arena`, `/simulations`, an interactive learning workspace, a teacher workspace, or an administrator workspace at a desktop viewport
- **THEN** the platform navigation SHALL render in the approved collapsed desktop rail by default
- **AND** route navigation SHALL remain reachable through icons, accessible labels, focus order, and active route indication.

#### Scenario: User changes navigation state
- **WHEN** the user expands or collapses the desktop navigation
- **THEN** the chosen state SHALL be persisted as a shell-owned preference
- **AND** subsequent student, teacher, administrator, and workspace AppShell routes SHALL restore that state until the user changes it again.

#### Scenario: Stored preference is missing or invalid
- **WHEN** AppShell cannot read a valid persisted navigation preference
- **THEN** it SHALL fall back to collapsed desktop navigation
- **AND** it SHALL NOT throw, render an invalid rail width, or create an uncontrolled layout state.

#### Scenario: Viewport changes to mobile
- **WHEN** the viewport uses the mobile platform navigation pattern
- **THEN** the persisted desktop rail preference SHALL NOT force a desktop rail into the mobile layout
- **AND** mobile drawer behavior SHALL remain governed by the mobile AppShell contract.

### Requirement: Interactive learning atlas routes use the shared shell
Interactive learning atlas routes SHALL use the shared platform shell, collapsed navigation contract, and shared floating assistant model.

#### Scenario: Interactive learning atlas route renders on desktop
- **WHEN** `/interactive-learning`, `/interactive-learning/courses`, `/interactive-learning/chapter-components`, or `/interactive-learning/cross-domain-exploration` renders at a desktop viewport
- **THEN** the page SHALL use the shared AppShell with default collapsed navigation
- **AND** the main page content SHALL expand as a fluid workspace rather than relying on a full-page fixed centered container
- **AND** the shared Konling floating dock SHALL remain the assistant entry.

#### Scenario: Interactive learning atlas route renders on mobile
- **WHEN** an atlas route renders at 320px width
- **THEN** global navigation SHALL move into the shared mobile navigation pattern
- **AND** the primary learning content SHALL remain reachable without horizontal overflow.

### Requirement: Interactive learning atlas follows accepted Product Design references
Interactive learning atlas implementation SHALL prove visual alignment with the accepted Product Design handoff and atlas concept images.

#### Scenario: Atlas visual QA runs
- **WHEN** the atlas route family is accepted
- **THEN** QA evidence SHALL cite `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- **AND** it SHALL cite `concepts/01-learning-atlas-course-catalog.png` and `concepts/revised/01-course-catalog-theory-practice.png`
- **AND** Product Design `design-qa` SHALL report `final result: passed`.

### Requirement: Concrete interactive course entries remain in AppShell
Concrete interactive course entry routes SHALL preserve platform shell, breadcrumb, theme, user center, and shared assistant continuity.

#### Scenario: Course entry route renders
- **WHEN** a concrete interactive course entry route renders
- **THEN** AppShell SHALL provide global navigation, breadcrumb, theme switching, user center, and shared Konling dock
- **AND** the entry route SHALL NOT introduce competing global navigation or a page-local topbar that replaces the platform shell.

### Requirement: Knowledge graph uses the shared floating dock
The knowledge graph workspace SHALL expose Konling and related shell-level floating controls through the shared platform dock.

#### Scenario: Konling is available on `/knowledge`
- **WHEN** Konling is enabled on the knowledge graph route
- **THEN** the assistant SHALL render through the shared right-bottom dock model
- **AND** page-local duplicate assistant regions or separate right-bottom fixed systems SHALL NOT render concurrently.

#### Scenario: Konling expands in the knowledge workspace
- **WHEN** the user expands Konling while directory tools, relation filters, legend, graph controls, or selected-node inspector are visible
- **THEN** the assistant SHALL remain keyboard reachable and readable
- **AND** it SHALL NOT obscure required graph controls, inspector actions, or primary graph interaction.

### Requirement: Lesson runtime routes preserve platform shell continuity
Interactive lesson runtime routes SHALL preserve AppShell continuity while expressing runtime-specific local controls.

#### Scenario: Runtime route renders
- **WHEN** a lesson runtime route renders
- **THEN** AppShell SHALL provide route breadcrumbs, theme switching, user center, and shared Konling dock
- **AND** local runtime controls SHALL NOT duplicate global navigation, replace the user center, or embed a second assistant panel.

#### Scenario: Invalid session renders
- **WHEN** a runtime session is invalid, missing, or unavailable
- **THEN** the route SHALL show an explicit blocking or recovery state with a clear return path
- **AND** it SHALL NOT show stale full classroom content alongside an ambiguous `Not found` message.

### Requirement: AppShell uses compact page edge spacing
The platform shell SHALL render registered route frames with compact fixed viewport edges instead of centering primary content inside dynamic wide-screen maximum-width containers.

#### Scenario: Wide desktop route frame renders
- **WHEN** a registered route frame renders at 1440px, 1920px, or 2560px width
- **THEN** the primary AppShell content edge SHALL remain governed by the navigation rail and compact spacing token
- **AND** the content frame SHALL NOT gain additional side gutters from `mx-auto max-w-*`, `container mx-auto`, or equivalent viewport-centered page wrappers.

#### Scenario: Text or form route renders
- **WHEN** a text, form, dashboard, report, learning, or operations page renders inside AppShell
- **THEN** the page-level frame SHALL still use compact edge spacing
- **AND** any narrower reading, form, modal, or preview measure SHALL be an internal component constraint rather than the outer page boundary.

#### Scenario: Compact spacing exception is retained
- **WHEN** a route or component keeps a page-level maximum width after the compact spacing migration
- **THEN** the exception SHALL be registered with the owning change, affected route or component, reason, and removal or permanence condition
- **AND** unregistered page-level centered wrappers SHALL fail governance.

#### Scenario: Page-level wrapper inventory is reviewed
- **WHEN** the compact spacing migration is accepted
- **THEN** every route-level or shell-level centered width wrapper SHALL be either migrated to compact edge spacing or recorded in the compact spacing exception inventory
- **AND** unclassified route files, shared shells, interactive runtime wrappers, legacy shells, text pages, form pages, and report pages SHALL block acceptance.

### Requirement: Route archetypes inherit sitewide compact spacing
The platform route archetypes SHALL share the compact spacing model unless an archetype-specific implementation narrows only an internal component.

#### Scenario: Route archetype content frame is reviewed
- **WHEN** `public-entry`, `learning-atlas`, `mission-workspace`, `knowledge-data-map`, `operations-console`, or `report-ledger` content frame classes are reviewed
- **THEN** each archetype SHALL use the shared compact edge model for its primary content area
- **AND** archetype-specific classes SHALL NOT reintroduce centered page caps as their default behavior.

#### Scenario: Navigation rail changes width
- **WHEN** desktop navigation switches between expanded, collapsed, or hidden states
- **THEN** the content edge MAY move by the navigation rail width
- **AND** it SHALL NOT move because the content frame is centered inside a maximum-width container.

### Requirement: Personal Center dispatch page consolidates learner record modules
The Personal Center route SHALL consolidate student dashboard and profile semantics into one AppShell-backed dispatch page.

#### Scenario: Personal Center renders
- **WHEN** an authenticated student opens the canonical Personal Center
- **THEN** the first viewport SHALL identify the current learner record, next action, evidence status, and key module routes without duplicating dashboard and profile hero sections
- **AND** the page SHALL include access to competency profile, learning statistics, recent activity, personalized reinforcement, evidence review, Arena summary where available, and class join or class binding actions.

#### Scenario: Learner data is incomplete
- **WHEN** profile, activity, Arena, or adaptive data is missing
- **THEN** the page SHALL show honest empty or limited states and preserve primary next actions
- **AND** it SHALL NOT hide the Personal Center behind a generic loading or disconnected profile page.

### Requirement: Bottom-right assistant entry opens Konling directly
The platform shell SHALL treat the bottom-right assistant affordance as a direct Konling launcher when Konling is available.

#### Scenario: Konling is available
- **WHEN** a primary route registers Konling as the floating assistant control
- **THEN** the visible bottom-right button SHALL open Konling directly
- **AND** it SHALL NOT require the user to open a generic “工具” menu first.

#### Scenario: Theme switching is available
- **WHEN** a route supports theme switching
- **THEN** theme switching SHALL be exposed through the top-right shell action area or homepage account/action area
- **AND** theme switching SHALL NOT be injected as a bottom-right floating menu item.

#### Scenario: Other local controls exist
- **WHEN** management, support, settings, or route-local controls are needed
- **THEN** they SHALL use AppShell action slots, local toolbars, or an approved secondary control pattern
- **AND** they SHALL NOT make the primary Konling launcher ambiguous.

### Requirement: Direct Konling launcher preserves safe-area behavior
The direct Konling launcher SHALL preserve dock safe-area, focus, z-index, and route-context behavior.

#### Scenario: Konling opens over a dense workspace
- **WHEN** Konling opens on knowledge graph, adaptive learning, Arena, simulation, interactive learning, or Control Workbench routes
- **THEN** the launcher and opened panel SHALL not overlap primary local controls, graph inspectors, forms, charts, or mobile navigation
- **AND** route-level context registration SHALL remain available to the Konling runtime.
