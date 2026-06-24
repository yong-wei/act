## ADDED Requirements

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
