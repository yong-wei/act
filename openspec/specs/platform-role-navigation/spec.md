## Purpose
Define role-specific platform entrypoints, route compatibility, feature-gated future destinations, and shared cockpit navigation contracts for student, teacher, admin, and unauthenticated surfaces.
## Requirements
### Requirement: Role navigation is centrally defined
The system SHALL define role-specific navigation entries through a central schema rather than page-local header lists.

#### Scenario: Student navigation is rendered
- **WHEN** a student page renders primary navigation
- **THEN** it SHALL expose the configured student entries in the canonical first-level order: 首页, 知识资源, 互动学习, 学习路径, 竞技场, 虚拟仿真, 控制工作台, 个人中心.
- **AND** the collapsed desktop rail MAY show icons only, but the expanded rail, accessible names, focus order, and active state SHALL preserve the same order and labels.
- **AND** 个人中心 SHALL be treated as account and learner-record reachability rather than a core learning product module.
- **AND** Data Center SHALL NOT be visible as a student core, review, or fallback navigation destination.

### Requirement: Homepage and student cockpit expose complete core entries
The system SHALL migrate homepage and student cockpit entry surfaces to the unified role-navigation model with a complete core student entry matrix.

#### Scenario: Student opens homepage or dashboard
- **WHEN** a student-visible homepage, `/dashboard`, or cockpit entry surface renders
- **THEN** it SHALL expose student product entries in the canonical relative order: 知识资源, 互动学习, 学习路径, 竞技场, 虚拟仿真, 控制工作台
- **AND** personal center access SHALL be exposed through account/profile action semantics rather than as a duplicate homepage center link.
- **AND** mobile layouts at 320px SHALL provide drawer or menu access to the same visible entries without dead links.
- **AND** the Interactive Learning entry SHALL target `/interactive-learning`.

### Requirement: Auth and profile entrypoints reuse shared navigation surfaces
The system SHALL keep login, role redirects, and profile/cockpit actions consistent with the unified role-navigation model.

#### Scenario: User signs in or opens profile
- **WHEN** `/login`, an embedded login surface, `/profile`, or an account menu profile action is opened during migration
- **THEN** the UI SHALL reuse the shared auth/profile entry contracts and return users to role-appropriate `/dashboard`, `/teacher`, or `/admin` cockpit destinations without duplicating page-local navigation.
- **AND** `/profile` SHALL remain reachable through account, cockpit, or profile-specific surfaces even though it is not a core student module entry.

### Requirement: Future destinations are feature-flagged
The system SHALL represent unavailable future destinations with explicit feature-flag metadata.

#### Scenario: Backing feature is not implemented
- **WHEN** a navigation entry depends on a future ResourceNode, adaptive path, Konling, governance, or experiment capability
- **THEN** the navigation schema SHALL either hide the entry or render a disabled state according to product configuration rather than linking to an incomplete route.

### Requirement: Role cockpit routing stays compatible
The system SHALL preserve role cockpit redirects and existing route aliases while unified navigation is introduced.

#### Scenario: Authenticated user opens cockpit action
- **WHEN** an authenticated user uses the cockpit action from any unified shell page
- **THEN** the user SHALL be routed to `/dashboard`, `/teacher`, or `/admin` according to their role.

### Requirement: Commercial navigation has three explicit layers
The system SHALL distinguish global product navigation, role cockpit navigation, and contextual workspace navigation.

#### Scenario: A product workspace renders
- **WHEN** Arena, Control Workbench, adaptive learning, interactive learning, teacher, or admin UI renders
- **THEN** it SHALL expose the appropriate contextual navigation without duplicating the full global navigation as a competing primary menu.

### Requirement: Student navigation is grouped by learning intent
The system SHALL support student-facing navigation groups for learn, practice, challenge, experiment, and review/profile intents.

#### Scenario: Student opens a primary entry surface
- **WHEN** a student-visible entry surface renders product destinations
- **THEN** it SHALL group or order entries by learning intent rather than by implementation module names alone.

### Requirement: Profile and cockpit actions have separate semantics
The system SHALL treat profile as an account or learning-record action and cockpit as the role-level operational entry.

#### Scenario: Both actions are available
- **WHEN** a page exposes both profile and cockpit access
- **THEN** the UI SHALL make cockpit the role workspace action and profile the account or record action without presenting both as equivalent primary module entries.

### Requirement: Contextual return targets are route-derived
The system SHALL derive contextual return targets from the current workspace mode and route context.

#### Scenario: Control Workbench opens from Arena
- **WHEN** Control Workbench is opened from an Arena challenge or publication
- **THEN** the return action SHALL target the corresponding Arena context instead of the generic interactive-learning page.

### Requirement: Authentication routes preserve destination intent
The system SHALL preserve callback and role intent through login, authentication error, account, profile, and cockpit entry surfaces.

#### Scenario: Student is redirected to login for profile
- **WHEN** a student opens `/login?callbackUrl=%2Fprofile`
- **THEN** the login surface SHALL preserve `/profile` as the intended destination after successful sign-in
- **AND** it SHALL expose account/profile and role cockpit semantics without presenting them as competing primary product modules.

### Requirement: Student intent groups drive commercial entry surfaces
The platform SHALL expose student destinations through the learning-intent groups learn, practice, challenge, experiment, review, and account/profile.

#### Scenario: Homepage or student cockpit renders commercial entries
- **WHEN** homepage or student cockpit renders primary product destinations
- **THEN** the visible grouping or ordering SHALL follow student intent groups
- **AND** implementation module names SHALL NOT be the only hierarchy used to organize the page.

### Requirement: Navigation coverage is testable
The system SHALL provide tests or script checks that verify central navigation coverage for commercial student intent groups, core destinations, account/profile semantics, and route aliases.

#### Scenario: Navigation schema changes
- **WHEN** the central navigation schema is changed
- **THEN** tests SHALL verify that learn, practice, challenge, experiment, review, and account/profile intents remain represented where required
- **AND** Interactive Learning, Arena, Control Workbench, adaptive learning, knowledge/resource workspace, simulations, and profile/cockpit access remain reachable according to route configuration.
- **AND** homepage center links, AppShell collapsed rail, AppShell expanded rail, and account/profile entrypoints SHALL not diverge from the canonical first-level order.

### Requirement: Navigation layers are explicit and non-competing
The system SHALL distinguish global product navigation, role cockpit navigation, contextual workspace navigation, and local tool navigation.

#### Scenario: A primary page renders navigation
- **WHEN** homepage, login, Interactive Learning, simulation hub, Control Workbench, Arena, adaptive learning, profile, teacher, admin, or knowledge graph renders
- **THEN** the page SHALL expose only the navigation layers relevant to its context
- **AND** local tool tabs, role cockpit links, and global product destinations SHALL NOT be presented as one undifferentiated menu.

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

### Requirement: Public entry routes preserve destination intent
Public entry routes SHALL preserve destination intent across login, role redirect, cockpit, profile, learning, and simulation entry actions.

#### Scenario: Login opens from a protected destination
- **WHEN** a user opens login with a callback URL
- **THEN** the login entry surface SHALL show the intended destination in route-aware language
- **AND** successful authentication SHALL continue to route to the callback or role cockpit according to existing authorization behavior.

### Requirement: Learning entry navigation uses student intent groups
Learning entry navigation SHALL organize destinations by learn, practice, challenge, experiment, review, and account/profile intent.

#### Scenario: Student opens a learning entry surface
- **WHEN** Interactive Learning, course catalog, or simulation hub renders
- **THEN** the current page context SHALL be clear
- **AND** adjacent learning destinations SHALL remain reachable without duplicating every global product link as primary content.

### Requirement: Navigation follows product journey layers
The system SHALL define navigation as layered product journeys rather than page-local route lists.

#### Scenario: A page renders navigation
- **WHEN** a public, student, workspace, teacher, admin, data, or report page renders
- **THEN** the visible navigation SHALL distinguish product orientation, role cockpit, contextual route trace, and local tools
- **AND** only the layers relevant to the page archetype SHALL receive primary visual weight.

#### Scenario: Navigation layers are checked against archetypes
- **WHEN** a route declares `public-entry`
- **THEN** product orientation SHALL be primary, role cockpit SHALL appear only as entry or account context, contextual route trace SHALL remain shallow, and local tools SHALL NOT dominate the first viewport
- **WHEN** a route declares `learning-atlas`
- **THEN** role cockpit and contextual route trace SHALL be primary, product orientation SHALL remain available as global context, and local tools SHALL be secondary to path discovery
- **WHEN** a route declares `mission-workspace`
- **THEN** contextual route trace and local tools SHALL be primary, role cockpit SHALL remain compact, and product orientation SHALL not compete with task execution
- **WHEN** a route declares `knowledge-data-map`
- **THEN** contextual route trace SHALL be primary, local tools SHALL support filtering or graph/data inspection, and role cockpit SHALL explain ownership or scope
- **WHEN** a route declares `operations-console`
- **THEN** role cockpit and local tools SHALL be primary, contextual route trace SHALL support repeated operator workflows, and product orientation SHALL remain secondary
- **WHEN** a route declares `report-ledger`
- **THEN** contextual route trace and local tools SHALL support evidence review, status filtering, and export actions, while role cockpit SHALL identify audience or governance scope.

### Requirement: Navigation style is unified across all stacks
The system SHALL apply one navigation style family across public, student, workspace, teacher, admin, knowledge, data, and report surfaces.

#### Scenario: User moves across page families
- **WHEN** a user moves between homepage, Interactive Learning, Arena, Control Workbench, knowledge graph, data center, teacher, admin, and report surfaces
- **THEN** navigation placement, route trace language, active state, account/cockpit semantics, and mobile collapse behavior SHALL remain recognizably consistent
- **AND** page-local sidebars or topbars SHALL NOT introduce a competing navigation language.

### Requirement: Role journeys connect UI surfaces to learning and governance outcomes
The system SHALL define student, teacher, and administrator journeys as connected workflows rather than disconnected route groups.

#### Scenario: A role journey is accepted
- **WHEN** a primary student, teacher, or administrator journey is added to the route inventory
- **THEN** it SHALL identify the entry route, role, business object, evidence source, next action, and report or governance destination
- **AND** surfaces that only display decorative cards or metrics without a next action SHALL fail the journey acceptance rule.

#### Scenario: The student journey is reviewed
- **WHEN** student surfaces are reviewed for redesign acceptance
- **THEN** the journey SHALL connect Interactive Learning or adaptive entry to a learning path, lesson, Arena task, simulation, or learner record object
- **AND** the evidence source SHALL include progress, attempt, knowledge, profile, or report evidence
- **AND** the next action SHALL lead to study, practice, simulation, reflection, or report review.

#### Scenario: The teacher journey is reviewed
- **WHEN** teacher surfaces are reviewed for redesign acceptance
- **THEN** the journey SHALL connect teacher entry or class/course operations to lesson plans, class sessions, student groups, assignments, reports, or evidence review objects
- **AND** the evidence source SHALL include class activity, student progress, Arena, session, assessment, or report evidence
- **AND** the next action SHALL lead to preparation, teaching, intervention, assessment, feedback, or report export.

#### Scenario: The administrator journey is reviewed
- **WHEN** administrator surfaces are reviewed for redesign acceptance
- **THEN** the journey SHALL connect administrator entry or governance operations to users, courses, resources, data quality, governance snapshots, or exported review objects
- **AND** the evidence source SHALL include platform status, data coverage, governance ledger, audit, or report evidence
- **AND** the next action SHALL lead to configuration, quality review, governance decision, publication, or export.

### Requirement: Primary route ledger assigns redesign ownership
The system SHALL maintain a primary route ledger that assigns each primary route to an experience archetype and owning migration change.

#### Scenario: Redesign series is planned
- **WHEN** a route belongs to homepage, auth, student entry, adaptive learning, Arena, simulation, Control Workbench, interactive runtime, learner record, knowledge, data center, teacher, admin, or report output
- **THEN** the route ledger SHALL record archetype, role scope, auth state, navigation layers, theme support, dock behavior, owning change, and visual QA profile
- **AND** no route SHALL have two owning changes without an explicit dependency or coupling rule.

#### Scenario: Special teaching and AI routes are inventoried
- **WHEN** classroom student player, course private student/player, teacher Arena, class analytics, student detail, AI, or AI copilot routes remain primary product routes
- **THEN** the route ledger SHALL assign them to an owning change and archetype or register a temporary exception
- **AND** the exception SHALL include owner, reason, affected capability, expiry, and removal condition.

### Requirement: Report-ledger inventory identifies real report surfaces
The system SHALL identify report-ledger routes or components before report visual migration is accepted.

#### Scenario: Report-ledger change is executed
- **WHEN** classroom, Arena, learner, governance, or data-center report and snapshot surfaces are redesigned
- **THEN** the route ledger SHALL identify whether each surface is a primary route, embedded component, export view, or temporary gap
- **AND** report-ledger ownership SHALL NOT take ownership of the source operational, knowledge, learner, or data-center shell unless explicitly declared.

### Requirement: Full ledger is distinct from representative screenshot matrix
The route ledger SHALL cover primary route ownership even when only representative routes are captured in a screenshot matrix.

#### Scenario: Visual QA matrix is smaller than route inventory
- **WHEN** a commercial UI PR only captures representative screenshots
- **THEN** the route ledger SHALL still identify every affected primary route and whether that route is directly captured, covered by a representative route, or temporarily excepted.

### Requirement: Route inventory is the navigation source of truth
The system SHALL use route inventory to determine shell frame, role scope, navigation layers, mobile behavior, and dock behavior for primary routes.

#### Scenario: Primary route renders
- **WHEN** homepage, login, dashboard, Interactive Learning, Arena, Control Workbench, knowledge graph, data center, teacher, admin, or report route renders
- **THEN** the route SHALL resolve its navigation layers from central inventory
- **AND** page-local navigation lists SHALL NOT override central role and journey semantics.
- **AND** page-local fallback code SHALL NOT add Data Center to a role scope that the central inventory excludes.

### Requirement: Data center is operations-scoped
Data Center SHALL be an operations and governance route limited to teacher and administrator roles.

#### Scenario: Student opens data center directly
- **WHEN** an authenticated student opens `/data-center`
- **THEN** the student SHALL NOT see data-center navigation, metrics, source tables, or governance panels.
- **AND** the user SHALL be redirected to `/profile/evidence` by default.
- **AND** any contextual override SHALL target a non-data-center learner-record or dashboard destination.

#### Scenario: Teacher or administrator opens data center
- **WHEN** a teacher or administrator opens `/data-center`
- **THEN** the user SHALL see data-center navigation and content according to operations role policy.

### Requirement: Homepage may use a public-entry variant while primary app routes converge
The system SHALL allow the homepage to use a branded public-entry navigation variant, but SHALL require other primary routes to converge on central shell navigation.

#### Scenario: Non-home primary route renders
- **WHEN** login callback, dashboard, profile, Interactive Learning, Arena, Control Workbench, knowledge graph, data center, teacher, admin, report, or classroom route renders
- **THEN** the route SHALL use AppShell or an approved workspace shell resolved from central inventory
- **AND** standalone topbars, sidebars, breadcrumbs, or floating tool systems SHALL NOT act as the primary navigation unless they are registered temporary adapters with removal conditions.

### Requirement: Mobile navigation preserves route-family reachability
The system SHALL provide mobile navigation parity for primary route families.

#### Scenario: Desktop sidebar is hidden
- **WHEN** a sidebar or large-screen navigation is hidden below a breakpoint
- **THEN** an equivalent mobile drawer, switcher, tab strip, or command surface SHALL expose the same route family
- **AND** the current location and return path SHALL remain visible.

### Requirement: Student review semantics are not ambiguous
The system SHALL distinguish learner record, evidence review, and platform data-center destinations.

#### Scenario: Student review entry is displayed
- **WHEN** the review/account intent appears in homepage, cockpit, profile, or mobile navigation
- **THEN** the UI SHALL explain whether the destination is personal learning record, evidence timeline, or platform data center
- **AND** `/profile` and `/data-center` SHALL NOT appear as equivalent actions without context.

### Requirement: Public and auth entries preserve role and destination intent
The system SHALL preserve role and callback intent through public and auth entry surfaces.

#### Scenario: Login is opened with callback
- **WHEN** a user opens `/login?callbackUrl=%2Fprofile` or another callback destination
- **THEN** the login surface SHALL visibly show the intended destination and role/cockpit relationship
- **AND** successful authentication SHALL keep existing callback routing behavior.

### Requirement: Student entry journey connects to evidence review
Student entry navigation SHALL connect learning intent to learner record and evidence review.

#### Scenario: Student completes a primary learning action
- **WHEN** the student follows entry navigation into course, practice, challenge, or experiment work
- **THEN** the return or next-step navigation SHALL offer a path to learner record, evidence timeline, or next recommendation where that evidence is available
- **AND** `/profile`, `/profile/evidence`, and `/data-center` SHALL retain distinct meanings.

### Requirement: Route ledger uses canonical archetypes at runtime
The central route inventory SHALL use canonical experience archetypes as the runtime vocabulary for primary route shell and navigation decisions.

#### Scenario: Primary route metadata is resolved
- **WHEN** homepage, login, dashboard, Interactive Learning, Arena, Control Workbench, adaptive practice, knowledge/data, learner record, teacher, admin, or report routes are resolved from the inventory
- **THEN** each route SHALL declare one of `public-entry`, `learning-atlas`, `mission-workspace`, `knowledge-data-map`, `operations-console`, or `report-ledger`
- **AND** legacy frame names SHALL be exposed only as temporary alias metadata with an owning change and retirement condition.

#### Scenario: Arena challenge detail is registered
- **WHEN** `/arena/challenges/[taskId]` is used as part of the unified mission migration path
- **THEN** the central route ledger SHALL register it as a primary route or covered route with route pattern, route file, `mission-workspace` archetype, owning change, Arena return-target behavior, visual QA profile, and legacy shell disposition
- **AND** mission migrations SHALL NOT define separate page-local shell metadata for this route outside the central ledger.

#### Scenario: Auth entry converges
- **WHEN** login or auth callback routes currently use `auth-entry` frame metadata
- **THEN** the route ledger SHALL resolve them through `public-entry` while preserving callback intent, auth panel behavior, unauthenticated state, and hidden dock rules
- **AND** `auth-entry` SHALL NOT become a seventh canonical archetype.

#### Scenario: Route ownership is reviewed
- **WHEN** the unified UI migration series is planned or executed
- **THEN** every primary route SHALL name exactly one owning migration change or a temporary exception
- **AND** existing `owningChange` values SHALL be preserved or explicitly migrated rather than silently overwritten
- **AND** duplicate ownership SHALL fail route ledger validation unless an explicit dependency or coupling rule is recorded.

### Requirement: Route ledger preserves navigation semantics during convergence
Canonical archetype migration SHALL preserve existing route access, role routing, callback intent, and contextual return behavior.

#### Scenario: Existing navigation paths are exercised
- **WHEN** a user opens login callbacks, profile/account actions, role cockpit actions, Arena-to-workbench returns, or learning entry routes during ledger convergence
- **THEN** the resolved route metadata SHALL preserve the existing destination intent
- **AND** profile sub-routes such as `/profile/growth`, `/profile/portfolio`, and `/profile/evidence` SHALL remain independent report-ledger routes with role-route-tab mobile navigation rather than compatibility aliases of `/profile`
- **AND** no page SHALL require page-local navigation lists to override the central route ledger.

#### Scenario: Compatibility aliases are reviewed
- **WHEN** a route declares compatibility aliases for migration or callback behavior
- **THEN** those aliases SHALL NOT duplicate another current primary route href in the central route ledger
- **AND** alias conflicts SHALL fail navigation inventory tests before they can affect governance or visual QA evidence resolution.

### Requirement: Route ledger exposes governance inputs
The central route ledger SHALL expose the metadata needed by unified UI governance gates.

#### Scenario: Governance reads the route ledger
- **WHEN** commercial UI governance evaluates a primary route
- **THEN** it SHALL be able to read archetype, owning change, temporary exception, legacy alias, legacy shell disposition, theme support, dock behavior, navigation layers, and visual QA profile from central route metadata
- **AND** governance SHALL not depend on scattered page-local declarations for those fields.

### Requirement: Student secondary routes share canonical journey navigation
Student secondary learning, practice, challenge, experiment, and learner-record routes SHALL share a canonical route-family navigation model derived from central route inventory and student learning intent groups.

#### Scenario: Student opens a secondary page
- **WHEN** a student opens Interactive Learning, course catalog, chapter components, cross-domain exploration, adaptive practice, Arena, Control Workbench, knowledge graph, profile, growth, or evidence routes
- **THEN** visible navigation SHALL identify the current route family and adjacent learn, practice, challenge, experiment, and learner-record destinations according to central metadata
- **AND** the route SHALL NOT replace the canonical journey navigation with page-local topbars, unrelated two-item sidebars, or implementation-module directories.

#### Scenario: A route has a local tool panel
- **WHEN** a page needs course filters, graph filters, practice controls, or workspace tools
- **THEN** those controls SHALL render as local tools within the page or AppShell workspace zones
- **AND** they SHALL NOT act as platform navigation.

#### Scenario: Interactive Learning first-hop destination renders
- **WHEN** a student follows an Interactive Learning entry action to chapter components or cross-domain exploration
- **THEN** the destination SHALL retain the same learning-atlas shell family and route trace
- **AND** it SHALL NOT fall back to the legacy `UnifiedTopBar` navigation language unless a route-ledger exception names the owner and removal condition.

### Requirement: Route inventory covers first-hop descendants
The central route inventory SHALL cover first-hop destinations and route-family descendants that are reachable from migrated primary routes.

#### Scenario: Migrated route exposes a primary action
- **WHEN** a migrated route links to a destination as a primary action, card action, command action, launch action, or workspace return target
- **THEN** the destination SHALL be registered directly, matched by a route pattern, or covered by an explicit route-family entry
- **AND** the inventory SHALL identify shell frame, role scope, navigation layers, mobile behavior, dock behavior, visual QA profile, and owner.

### Requirement: Contextual breadcrumbs persist across route families
The platform SHALL preserve contextual breadcrumbs and return targets when users move from parent routes into first-hop or descendant pages.

#### Scenario: User opens a descendant learning page
- **WHEN** a user moves from `/interactive-learning/chapter-components` into a chapter category or from a category into a resource page
- **THEN** the destination SHALL show a route trace back to the Interactive Learning context and the immediate parent category where applicable
- **AND** the return target SHALL be route-derived rather than a page-local hardcoded homepage link.

#### Scenario: User opens a cross-domain resource page
- **WHEN** a user moves from `/interactive-learning/cross-domain-exploration` into `/interactive-learning/resources/[id]`
- **THEN** the destination SHALL show a route trace back to the Interactive Learning context and cross-domain exploration source
- **AND** the return target SHALL preserve the source route rather than falling back to a page-local Interactive Learning homepage link.

### Requirement: Route inventory accepts only governed next-action continuity
Route-family inventory SHALL accept migrated entry pages only when their first student action stays within a registered shell family or a bounded exception.

#### Scenario: Student follows first action from a migrated entry
- **WHEN** a student follows the first learning, practice, challenge, experiment, review, or launch action from a migrated route
- **THEN** the destination SHALL remain within the unified navigation family or declare a bounded exception
- **AND** the parent route SHALL NOT be accepted as migrated if the first action opens an untracked local shell.

### Requirement: Route navigation inventory supports collapsed default shell state
Platform route inventory SHALL remain complete and usable when the desktop AppShell navigation defaults to collapsed.

#### Scenario: Collapsed navigation renders role-scoped entries
- **WHEN** a student, teacher, or administrator opens a route with collapsed desktop AppShell navigation
- **THEN** only routes allowed for that role SHALL appear
- **AND** each visible entry SHALL expose an icon, accessible name, route target, and active-state metadata.

#### Scenario: Route frame declares navigation behavior
- **WHEN** a primary route declares AppShell route metadata
- **THEN** its route inventory entry SHALL identify whether desktop navigation is collapsible
- **AND** routes that cannot support collapsed desktop navigation SHALL declare a temporary exception with owner and removal condition.

### Requirement: Interactive learning atlas preserves route hierarchy
Interactive learning atlas routes SHALL expose platform breadcrumbs and return continuity for multi-level learning navigation.

#### Scenario: User opens a nested interactive learning page
- **WHEN** the user opens an interactive learning catalog, chapter component list, or cross-domain list route
- **THEN** the platform breadcrumb SHALL identify the route hierarchy from home to the current surface
- **AND** route-local controls SHALL NOT replace platform navigation or obscure the return path.

#### Scenario: User enters cross-domain exploration list
- **WHEN** the cross-domain exploration list is shown
- **THEN** the list shell SHALL preserve route continuity
- **AND** Control Odyssey and Ten Drops internals MAY keep their own interaction-specific layouts outside this change.

### Requirement: Homepage account action uses personal-center semantics
The homepage SHALL expose product module links separately from account or learner-record access.

#### Scenario: Homepage navigation renders
- **WHEN** the homepage topbar renders for a guest or authenticated user
- **THEN** the center navigation SHALL include only 知识资源, 互动学习, 学习路径, 竞技场, 虚拟仿真, and 控制工作台 in canonical order
- **AND** the right side SHALL expose 个人中心 and theme switching using shared account/action semantics
- **AND** it SHALL NOT render “进入驾驶舱” as a separate primary action.

### Requirement: Student Personal Center is a single first-level destination
The platform SHALL present Personal Center as the single student-facing account and learner-record destination.

#### Scenario: Student opens personal center navigation
- **WHEN** a student uses homepage, AppShell rail, account menu, or role entry navigation to open learner record or account context
- **THEN** the UI SHALL route to `/profile` as the canonical Personal Center destination labeled 个人中心
- **AND** it SHALL NOT present `/dashboard` and `/profile` as two equivalent first-level destinations.

#### Scenario: Existing dashboard links are used
- **WHEN** an existing link, callback, or role-cockpit contract opens `/dashboard`
- **THEN** the platform SHALL preserve compatibility by redirecting, wrapping, or otherwise resolving to the `/profile` Personal Center experience
- **AND** authorization and role redirects SHALL remain intact.

#### Scenario: Profile subroutes remain reachable
- **WHEN** a student needs growth, portfolio, or evidence details
- **THEN** `/profile/growth`, `/profile/portfolio`, and `/profile/evidence` SHALL remain reachable as secondary Personal Center views or report-ledger routes.

### Requirement: Role operation navigation is secondary to global route navigation
Teacher and administrator operation navigation SHALL not replace or reorder the global first-level platform navigation.

#### Scenario: Teacher operation navigation is visible
- **WHEN** a teacher route shows classes, lesson plans, resources, prep packs, history, analytics, or report tools
- **THEN** those controls SHALL be presented as secondary workflow navigation
- **AND** the global first-level navigation SHALL remain available through the AppShell frame.

#### Scenario: Admin domain navigation is visible
- **WHEN** an admin route shows user, config, state, data-governance, or model-management domains
- **THEN** those controls SHALL be presented as admin workflow navigation
- **AND** they SHALL not be mixed into the student module order.

