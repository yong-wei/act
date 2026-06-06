# commercial-ui-governance-gates Specification

## Purpose
Define automated and review-based governance gates that protect commercial UI consistency across platform tokens, shells, navigation, module chrome, visual acceptance evidence, accessibility, and text fit.
## Requirements
### Requirement: Commercial UI governance has advisory and blocking modes
The system SHALL support advisory and blocking governance modes for commercial UI rules so migrations can report legacy debt before strict enforcement begins.

#### Scenario: Governance runs during migration
- **WHEN** a commercial UI governance check runs while allowlisted legacy debt remains
- **THEN** advisory mode SHALL report the violation and owning migration reference
- **AND** blocking mode SHALL fail only new or unallowlisted violations according to the migration stage.

#### Scenario: Default test encounters commercial UI debt
- **WHEN** the default project test command includes commercial UI governance
- **THEN** any failure for `/` or another primary route SHALL be treated as real UI governance debt unless it has a narrow temporary exception
- **AND** dependency-upgrade work SHALL NOT classify that failure as package noise.

### Requirement: Token governance rejects unapproved page-local palettes
The system SHALL detect unapproved page-local color families, raw decorative gradients, and unregistered status colors in student-facing and workspace UI.

#### Scenario: New UI introduces a local color system
- **WHEN** a new or migrated student-facing page, workspace, shell, panel, or module uses raw hex colors, unregistered Tailwind color families, or page-local gradient systems outside approved primitives
- **THEN** the governance gate SHALL fail or report the violation according to the current enforcement mode.

### Requirement: Shell governance requires registered route frames
The system SHALL require primary student, workspace, teacher, and admin route frames to use registered platform or commercial workspace shells.

#### Scenario: A new route introduces its own header shell
- **WHEN** a route adds or changes a primary page frame, top bar, side bar, breadcrumb area, or account action surface
- **THEN** the governance gate SHALL verify that the route uses a registered shell or a documented migration exception.

### Requirement: Visual review checks commercial hierarchy
The system SHALL require review evidence for brand fit, visual hierarchy, responsive layout, first-viewport usefulness, and dense-workspace task visibility when commercial UI surfaces are changed.

#### Scenario: A PR changes a commercial UI surface
- **WHEN** a PR changes homepage, student cockpit, Interactive Learning, Arena, adaptive learning, profile, Control Workbench, interactive course runtime, teacher analytics, or admin governance UI
- **THEN** the review checklist SHALL include visual evidence or screenshots for desktop and mobile
- **AND** reviewers SHALL check for generic AI gradients, decorative card repetition, incoherent navigation hierarchy, hidden primary tasks, and text overlap.

### Requirement: Governance allowlists are explicit and temporary
The system SHALL keep commercial UI governance allowlists explicit, scoped, dated, and tied to migration changes.

#### Scenario: A legacy violation is allowed during migration
- **WHEN** a known legacy page violates a commercial UI rule
- **THEN** the allowlist entry SHALL name the path, violated rule, owning migration change or issue, and removal condition
- **AND** new unrelated violations SHALL NOT be covered by that allowlist.

### Requirement: Visual acceptance matrix is explicit
The system SHALL require commercial UI changes to identify and verify the representative route matrix affected by the change.

#### Scenario: Commercial UI change is reviewed
- **WHEN** a PR changes login/auth, homepage, student cockpit, Interactive Learning, Arena, adaptive learning, profile, Control Workbench, interactive course runtime, teacher analytics, admin governance, or report UI
- **THEN** the review evidence SHALL identify the affected routes
- **AND** it SHALL include desktop and 320px mobile checks for every affected representative route.

### Requirement: Accessibility and text-fit gates protect commercial quality
The system SHALL require commercial UI changes to satisfy contrast, visible focus, keyboard reachability, reduced-motion, button text-fit, and mobile text-overlap criteria.

#### Scenario: A commercial UI surface is changed
- **WHEN** the surface contains navigation, buttons, forms, panels, charts, cards, module prompts, or status labels
- **THEN** text SHALL remain readable at desktop and 320px mobile widths
- **AND** keyboard focus SHALL be visible
- **AND** button labels SHALL not wrap incoherently
- **AND** foreground/background contrast SHALL meet the project accessibility threshold.

### Requirement: Visual QA covers theme parity and floating controls
Commercial UI governance SHALL require representative screenshot evidence for light theme, dark theme, responsive layout, and floating action dock placement when primary route frames are changed.

#### Scenario: A primary shell migration is reviewed
- **WHEN** a PR changes AppShell, route navigation, floating action dock, homepage, login, Interactive Learning, simulation, Control Workbench, learner profile, teacher, admin, or knowledge graph UI
- **THEN** visual evidence SHALL include representative desktop and 320px mobile screenshots in both light and dark themes where the route supports theme switching
- **AND** the evidence SHALL show that Konling and management/settings controls do not overlap page content, local toolbars, or each other.

### Requirement: Background browser capture is an accepted review method
The system SHALL allow background Playwright or equivalent browser capture as the default visual verification method for local UI review.

#### Scenario: Visual QA runs locally
- **WHEN** a UI migration needs visual evidence
- **THEN** the reviewer MAY use background browser automation against the local dev server to capture route screenshots without depending on Codex window size
- **AND** the captured artifacts SHALL identify route, theme, viewport, authentication role, and timestamp or run id.

### Requirement: Commercial UI acceptance requires archetype conformance
Commercial UI governance SHALL reject primary route migrations that cannot demonstrate conformance to the registered experience archetype.

#### Scenario: A redesigned page is reviewed
- **WHEN** a PR changes a primary UI route
- **THEN** review evidence SHALL name the route archetype, supported navigation layers, light/dark template behavior, mobile behavior, and first-viewport primary task
- **AND** the page SHALL fail acceptance if it only adds platform tokens, borders, screenshots, or `data-commercial-*` markers without matching the archetype.

### Requirement: Temporary exceptions are narrow and scheduled for removal
Commercial UI governance SHALL allow temporary exceptions only for legacy pages that cannot be migrated in the current change.

#### Scenario: A legacy shell remains
- **WHEN** a primary route keeps an incompatible legacy shell or local navigation pattern
- **THEN** the exception SHALL name the route, violated archetype rule, owning downstream issue, and removal condition
- **AND** the exception SHALL NOT cover newly introduced UI.

### Requirement: Experience acceptance rejects template-only composition
Commercial UI governance SHALL reject route migrations that use the new vocabulary without demonstrating route continuity, non-template composition, mobile behavior, and theme parity.

#### Scenario: A migrated route is accepted
- **WHEN** a primary route migration is reviewed
- **THEN** the evidence SHALL show non-template composition tied to the declared archetype, continuity from prior route or role entry to next action, desktop and 320px mobile behavior, and light/dark theme parity where theme switching is supported
- **AND** screenshots, `data-commercial-*` markers, token usage, borders, or repeated card sections SHALL NOT be sufficient acceptance evidence on their own.

### Requirement: Decorative entry pages fail role-journey acceptance
Commercial UI governance SHALL reject entry pages that do not connect to a role journey, current task, evidence state, or next action.

#### Scenario: A public or role entry page is reviewed
- **WHEN** homepage, login, dashboard, Interactive Learning entry, student cockpit, teacher entry, or admin entry is redesigned
- **THEN** the page SHALL identify its role journey, business object or learning object, relevant evidence or status state, next action, and downstream report or governance destination when applicable
- **AND** decorative hero sections, atmospheric imagery, isolated feature grids, or metrics without role action SHALL fail acceptance unless registered as a temporary migration exception.

### Requirement: Governance enforces route ledger and archetype conformance
Commercial UI governance SHALL verify primary route ledger coverage and archetype conformance.

#### Scenario: UI route changes
- **WHEN** a PR changes a primary UI route or shared shell
- **THEN** governance SHALL verify the route has ledger metadata, owning change, archetype, theme support, navigation layers, and dock behavior
- **AND** the route SHALL fail blocking mode if it lacks required metadata after migration.

### Requirement: Governance rejects legacy navigation without disposition
Commercial UI governance SHALL reject non-home primary routes that retain unregistered page-local navigation or shell systems.

#### Scenario: Non-home route changes
- **WHEN** a primary route other than the homepage changes navigation, shell, breadcrumb, sidebar, or floating controls
- **THEN** governance SHALL verify AppShell or approved workspace shell metadata, or a temporary adapter disposition with removal condition
- **AND** routes with outdated archetype names, unregistered shell frames, or legacy shell without disposition SHALL fail blocking mode.

### Requirement: Visual evidence includes structured route metadata
Commercial UI visual evidence SHALL include structured route metadata.

#### Scenario: Screenshot evidence is captured
- **WHEN** visual QA artifacts are produced
- **THEN** each artifact manifest SHALL identify route, archetype, theme, viewport, auth state, role state, dock state, first-viewport task visibility, and result
- **AND** missing or stale metadata SHALL fail the relevant governance mode.

### Requirement: Visual evidence capture completeness is enforced
Commercial UI governance SHALL detect when requested visual evidence routes or states were not captured.

#### Scenario: Visual QA route matrix is executed
- **WHEN** the visual QA manifest requests multiple routes, themes, viewports, or role states
- **THEN** governance SHALL compare requested evidence with produced artifacts
- **AND** missing captures, stale captures, route inventory drift, or visual QA matrix drift SHALL fail the relevant governance mode.

### Requirement: Mobile quality gates reject desktop squeeze-down
Commercial UI governance SHALL reject mobile layouts that merely squeeze desktop sidebars, filters, or workbench panels into the viewport.

#### Scenario: 320px mobile evidence is reviewed
- **WHEN** primary route mobile evidence is evaluated
- **THEN** permanent sidebars, filter panels, and configuration blocks SHALL not hide the primary task or canvas
- **AND** drawer, sheet, tab, or command surfaces SHALL preserve reachability of secondary controls.

### Requirement: Dock and local controls do not collide
Commercial UI governance SHALL validate shared dock behavior across workspaces and report surfaces.

#### Scenario: Dock evidence is reviewed
- **WHEN** Konling, issue badge, settings, management, page tools, support drawers, or report/export controls are visible
- **THEN** evidence SHALL show safe-area, z-index, keyboard reachability, and non-overlap at 1440px and 320px
- **AND** separate right-bottom fixed systems SHALL fail blocking mode after dock migration.

### Requirement: Report/export evidence is governed
Commercial UI governance SHALL validate report and export readability where report-ledger surfaces are changed.

#### Scenario: Report-ledger surface changes
- **WHEN** report, snapshot, print, or export UI changes
- **THEN** evidence SHALL show watermark, privacy labels, source labels, charts, tables, formulas, and key metrics remain readable
- **AND** unavailable data SHALL be represented as honest status, not fabricated output.
