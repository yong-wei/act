## ADDED Requirements

### Requirement: Governance validates compact page edges
Commercial UI governance SHALL validate that primary routes and migrated workspaces use stable compact page edges and do not waste wide-screen space through unregistered centered page caps.

#### Scenario: Source governance scans page wrappers
- **WHEN** commercial UI governance scans route files, AppShell frame definitions, interactive runtime shells, legacy shells, and workspace wrappers
- **THEN** page-level uses of `mx-auto max-w-*`, `container mx-auto`, or equivalent centered maximum-width wrappers SHALL fail unless they are registered as component-intrinsic exceptions
- **AND** the failure SHALL name the route or wrapper and the owning migration condition.

#### Scenario: Wide-screen visual evidence is reviewed
- **WHEN** a PR changes AppShell frame spacing, interactive course runtime spacing, or route-level page wrappers
- **THEN** visual evidence SHALL include representative 1440px, 1920px, and 2560px screenshots and DOM metrics
- **AND** the evidence SHALL prove primary content edges remain within the compact edge token tolerance and do not expand side gutters with viewport width.

#### Scenario: Mixed desktop breakpoint evidence is reviewed
- **WHEN** route families expose local tools, inspectors, floating docks, runtime control bars, or support drawers
- **THEN** visual evidence SHALL include 1024px, 1100px, and 1279px screenshots and DOM metrics with expanded, collapsed, and hidden navigation states as applicable
- **AND** the evidence SHALL show no overlap, horizontal page scroll, trapped viewport, or unreachable control when auxiliary surfaces are open.

#### Scenario: Responsive visual evidence is reviewed
- **WHEN** compact spacing changes are accepted
- **THEN** visual evidence SHALL also include tablet and 320px mobile states for representative route families
- **AND** the evidence SHALL show no horizontal overflow, text overlap, unreachable controls, or floating dock collision.

#### Scenario: Representative route family evidence is reviewed
- **WHEN** compact spacing visual acceptance is reviewed
- **THEN** evidence SHALL include at least one text-first route, one form-first route, one report or evidence route, one knowledge map route, one interactive course entry route, one student runtime route, and one teacher runtime route
- **AND** text and form pages MAY keep internal reading measures but SHALL NOT center the entire outer page inside a maximum-width wrapper.

### Requirement: Compact spacing exceptions are explicit
Commercial UI governance SHALL maintain an explicit exception list for legitimate component-intrinsic width constraints.

#### Scenario: A narrow constraint remains
- **WHEN** a dialog, popover, image preview, chart aspect-ratio wrapper, print/export page, or intentionally measured text component keeps a maximum width
- **THEN** it SHALL be classified as component-intrinsic rather than page-level spacing
- **AND** the exception SHALL identify the source file, reason, scope, and whether it is permanent or scheduled for removal.

#### Scenario: Unregistered centered layout is introduced
- **WHEN** a new or modified UI surface introduces a page-level centered maximum-width wrapper without an approved exception
- **THEN** commercial UI governance SHALL fail in blocking mode.
