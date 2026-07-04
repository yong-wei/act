## ADDED Requirements

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
