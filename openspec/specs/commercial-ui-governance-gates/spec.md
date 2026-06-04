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
