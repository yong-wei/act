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

### Requirement: Role workspaces use the unified AppShell navigation frame
Teacher and administrator primary workspaces SHALL use AppShell or registered AppShell-compatible wrappers for first-level shell navigation.

#### Scenario: Teacher workspace renders
- **WHEN** a teacher primary route renders
- **THEN** it SHALL expose the same first-level AppShell navigation frame, top-right account access, and theme switching conventions as other primary platform routes
- **AND** teacher operation tabs SHALL render as secondary workflow navigation rather than competing first-level navigation.

#### Scenario: Administrator workspace renders
- **WHEN** an administrator primary route renders
- **THEN** it SHALL expose the same first-level AppShell navigation frame, account access, and theme switching conventions
- **AND** admin domain controls SHALL remain local or secondary to the admin workflow.

#### Scenario: Role workspace cannot migrate immediately
- **WHEN** a teacher or administrator route must keep a legacy layout during migration
- **THEN** the route ledger or governance allowlist SHALL declare the affected route, owner, reason, violated shell rule, and removal condition
- **AND** the exception SHALL NOT apply to newly introduced role workspace routes.

### Requirement: Role workspaces expose role-aware Personal Center actions
The platform shell SHALL expose a consistent top-right 个人中心/account action for student, teacher, and administrator roles without routing teachers or administrators into the student learner-record profile.

#### Scenario: Student role action renders
- **WHEN** a student route renders the top-right shell action area
- **THEN** 个人中心 SHALL target `/profile`.

#### Scenario: Teacher role action renders
- **WHEN** a teacher route renders the top-right shell action area
- **THEN** 个人中心 SHALL target a teacher account or operations-center destination registered for the teacher role
- **AND** it SHALL NOT route to the student learner-record profile unless that route has an explicit teacher-safe mode.

#### Scenario: Administrator role action renders
- **WHEN** an administrator route renders the top-right shell action area
- **THEN** 个人中心 SHALL target an administrator account or operations-center destination registered for the administrator role
- **AND** it SHALL NOT route to the student learner-record profile unless that route has an explicit administrator-safe mode.

### Requirement: Non-home application routes use the universal AppShell frame
Every non-home application route SHALL render through the universal AppShell frame or an explicitly registered AppShell-compatible wrapper.

#### Scenario: A normal application route renders
- **WHEN** any non-home route under `src/app/**/page.tsx` renders as a product, learning, classroom, simulation, teacher, administrator, AI, or account surface
- **THEN** the route SHALL expose the shared AppShell top bar and first-level navigation frame
- **AND** it SHALL NOT define a competing page-local first-level header or static sidebar.

#### Scenario: A route cannot use the normal shell
- **WHEN** a route is auth-only, print-only, visual-review-only, embed-only, or otherwise intentionally shell-free
- **THEN** the route SHALL be listed in a governed exception inventory with owner, reason, violated shell rule, and removal condition
- **AND** unclassified routes SHALL fail static governance tests.

### Requirement: Canonical primary navigation is consistent across routes
The platform SHALL use the same primary navigation order across all AppShell-backed non-home routes.

#### Scenario: Desktop navigation renders
- **WHEN** a non-home AppShell route renders on a desktop viewport
- **THEN** the left navigation SHALL use the canonical order: 首页, 知识资源, 互动学习, 学习路径, 竞技场, 虚拟仿真, 控制工作台, 个人中心
- **AND** ordinary product routes SHALL use the collapsible left rail unless the exception inventory explicitly permits another behavior.

#### Scenario: A nested route renders
- **WHEN** a second-level or deeper product route renders
- **THEN** it SHALL keep the same first-level navigation rail and active top-level destination as its parent product area
- **AND** local workflow navigation SHALL render only inside content, workspace slots, or route-local toolbars.

### Requirement: AppShell top-right actions have one fixed order
The AppShell header SHALL own account and theme actions consistently.

#### Scenario: Header actions render
- **WHEN** any non-exempt non-home route renders
- **THEN** the top-right action area SHALL render exactly the shell-owned theme switch first and the role-aware Personal Center action second
- **AND** route-local controls, assistant controls, return links, path management, filters, exports, and settings SHALL NOT appear inside that shell action pair.

#### Scenario: A route has local management commands
- **WHEN** a route needs commands such as path management, return to exploration, settings, export, or local filters
- **THEN** those commands SHALL render in page content, a workspace toolbar, or an approved local command area
- **AND** they SHALL NOT replace or reorder the shell-level theme switch and Personal Center actions.

### Requirement: AppShell-compatible wrappers are governed
Routes SHALL count as AppShell-covered through a wrapper only when that wrapper is registered and passes the shared shell DOM contract.

#### Scenario: Wrapper coverage is evaluated
- **WHEN** a route is covered by a wrapper rather than direct `AppShell` usage
- **THEN** the wrapper SHALL be listed in the governed wrapper registry with owned route families and contract tests
- **AND** the wrapper SHALL verify canonical navigation, breadcrumb rendering, and the fixed theme-switch-then-Personal-Center action pair.

### Requirement: Non-home AppShell routes expose breadcrumbs
Every non-home AppShell route SHALL expose a breadcrumb trail through the shared top bar.

#### Scenario: A route has a parent product area
- **WHEN** the route is under a product area or workflow
- **THEN** its AppShell header SHALL include breadcrumbs that identify the parent area and current page
- **AND** the route SHALL NOT rely on isolated back buttons as the only orientation mechanism.

### Requirement: Primary product modules share one AppShell chrome
Primary product entry routes SHALL use the same AppShell navigation rail, top bar, breadcrumb convention, and account/theme action placement.

#### Scenario: Primary product route renders
- **WHEN** `/knowledge`, `/interactive-learning`, `/assessment/adaptive-practice`, `/arena`, `/simulations`, `/interactive-learning/control-workbench`, or `/profile` renders
- **THEN** the route SHALL render the canonical collapsible left navigation rail
- **AND** the route SHALL render top-right actions as exactly the shell-owned theme switch followed by the role-aware Personal Center action.

#### Scenario: Knowledge Graph renders
- **WHEN** the Knowledge Graph route renders
- **THEN** the top bar SHALL include a breadcrumb trail that orients the user inside the platform
- **AND** the graph canvas SHALL NOT replace shell breadcrumbs with canvas-local controls.

#### Scenario: Learning Path renders
- **WHEN** the Learning Path surface renders through `/assessment/adaptive-practice`
- **THEN** path management commands SHALL render as local page commands
- **AND** they SHALL NOT occupy the shell account/theme action area.

#### Scenario: Control Workbench renders
- **WHEN** the Control Workbench renders
- **THEN** return-to-exploration or return-to-challenge actions SHALL be expressed through breadcrumbs, contextual return, or local command bars
- **AND** they SHALL NOT appear in the shell top-right account/theme action pair.

#### Scenario: Arena and Virtual Simulation render
- **WHEN** Arena or Virtual Simulation routes render
- **THEN** Personal Center SHALL appear after the theme switch with the same style as other primary routes
- **AND** page-specific controls SHALL not reorder or restyle that pair.

#### Scenario: Primary route responsive states are checked
- **WHEN** primary routes are visually validated
- **THEN** validation SHALL cover 1440, 1280, 1024, 768, 390, and 320 viewport widths
- **AND** it SHALL verify rail collapse/expand, mobile drawer open/closed, breadcrumb truncation, right-action wrapping, no overlap, and no horizontal overflow.

### Requirement: Deep product routes preserve the universal shell
Second-level and deeper product routes SHALL keep the universal AppShell frame unless they are listed in the governed exception inventory.

#### Scenario: Course or lesson route renders
- **WHEN** a course entry, student lesson runtime, teacher lesson runtime, or waiting route renders
- **THEN** it SHALL keep the canonical left navigation rail and shared top bar unless the specific runtime page is listed in the governed exception inventory
- **AND** lesson controls SHALL render as local tools or workspace slots rather than replacing the shell frame.

#### Scenario: Classroom route renders
- **WHEN** a classroom join, student session, teacher session, or classroom review route renders
- **THEN** it SHALL expose the shared top bar, breadcrumbs, and canonical first-level navigation unless the live runtime route is listed in the governed exception inventory
- **AND** teaching controls SHALL remain local to the classroom workflow.

#### Scenario: AI, playlist, teacher, administrator, or legacy route renders
- **WHEN** an AI assistant, playlist, dashboard, missions, teacher, administrator, data-center, graph-center, or legacy learning route renders
- **THEN** it SHALL use the universal shell or an AppShell-compatible wrapper
- **AND** its active navigation state SHALL resolve to the correct first-level product area.

#### Scenario: Role route renders
- **WHEN** a teacher or administrator route renders
- **THEN** it SHALL keep the same shell top bar and canonical left navigation behavior
- **AND** its Personal Center action SHALL target the role-safe account or operations destination rather than the student learner profile unless an explicit teacher-safe or administrator-safe profile mode exists.

#### Scenario: Immersive workflow needs more space
- **WHEN** a deep route needs an immersive layout for teaching, simulation, or review
- **THEN** it MAY use AppShell workspace slots, hidden local panels, or responsive density controls
- **AND** it SHALL NOT remove first-level orientation unless the route is in the governed exception inventory.

#### Scenario: Deep route wrapper is evaluated
- **WHEN** a deep route is covered by `InteractiveLearningShell`, `CourseEntryShell`, `LessonRuntimeShell`, `ArenaPageShell`, a simulation shell, classroom shell, teacher shell, or administrator shell
- **THEN** that wrapper SHALL be registered and tested against the shared AppShell DOM contract
- **AND** route-local commands SHALL render in the wrapper's local command region rather than in the shell account/theme action pair.

### Requirement: AppShell route coverage is governed by tests
The platform SHALL include automated governance that detects non-home routes without universal shell coverage.

#### Scenario: Route source coverage is checked
- **WHEN** the shell governance test scans `src/app/**/page.tsx`
- **THEN** every non-home application route SHALL be classified as direct AppShell-covered, covered through a registered AppShell-compatible wrapper, or explicitly exempt
- **AND** unclassified routes SHALL fail the test.

#### Scenario: Exception inventory is checked
- **WHEN** a route is exempt from the universal shell frame
- **THEN** the exception record SHALL include route pattern, category, owner, reason, violated shell rule, and removal condition
- **AND** ordinary product, lesson, classroom, AI, graph, path, simulation, profile, teacher, or administrator pages SHALL NOT be exempt without a temporary blocker.

### Requirement: AppShell visual and DOM consistency is verified
The platform SHALL verify visible shell consistency on representative routes.

#### Scenario: Representative route matrix is tested
- **WHEN** primary and deep route representatives are loaded in browser validation
- **THEN** the tests SHALL verify canonical left navigation order, breadcrumb presence, and the exact top-right action order of theme switch followed by role-aware Personal Center
- **AND** screenshots SHALL demonstrate the same shell style across 1440, 1280, 1024, 768, 390, and 320 viewport widths.

#### Scenario: Wrapper registry is checked
- **WHEN** a route is classified through an AppShell-compatible wrapper
- **THEN** the wrapper SHALL be present in the governed wrapper registry and have passing DOM contract tests
- **AND** the route SHALL NOT count as covered merely because the wrapper name imports `AppShell`.

#### Scenario: Role-aware account targets are checked
- **WHEN** teacher or administrator routes are validated
- **THEN** the Personal Center action target SHALL be asserted as role-safe
- **AND** it SHALL NOT point to the student learner profile unless an explicit teacher-safe or administrator-safe profile mode exists.

#### Scenario: New routes are added
- **WHEN** a new route is added under `src/app/**/page.tsx`
- **THEN** it SHALL fail governance until it uses the universal shell or adds an approved exception record
- **AND** adding a route-local topbar or static sidebar SHALL NOT satisfy the shell contract.

### Requirement: Platform layers prevent shell controls from obscuring Konling
The platform shell SHALL assign registered layer ownership to account controls, Konling side and maximized surfaces, overlays, and the floating dock.

#### Scenario: Account menu and Konling are visible
- **WHEN** the profile or account control shares the viewport with Konling
- **THEN** the account layer SHALL NOT cover Konling's header controls, message content, composer, or action cards.

#### Scenario: Konling maximized workspace opens
- **WHEN** the full-screen assistant opens
- **THEN** it SHALL own the modal workspace layer, safe-area layout, and keyboard focus
- **AND** closing or restoring SHALL return focus to the control that changed the mode.

#### Scenario: Representative route is tested
- **WHEN** Konling is exercised at desktop and mobile widths on shell and immersive routes
- **THEN** the floating dock, account controls, page actions, and Konling controls SHALL remain reachable without collision.

### Requirement: 平台壳层交付规范站点图标

平台 SHALL 在 `/favicon.ico` 提供可公开访问的站点图标，浏览器请求该路径 SHALL 得到图片响应而非 404 页面。图标视觉 SHALL 遵循平台品牌资产体系。

#### Scenario: 浏览器请求站点图标

- **WHEN** 任意访客请求 `/favicon.ico`
- **THEN** 响应为图片内容与对应 Content-Type
- **AND** 不返回 404 或 HTML 错误页

