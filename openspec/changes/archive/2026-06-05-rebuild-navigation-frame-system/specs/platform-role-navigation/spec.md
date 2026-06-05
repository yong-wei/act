## ADDED Requirements

### Requirement: Route inventory is the navigation source of truth
The system SHALL use route inventory to determine shell frame, role scope, navigation layers, mobile behavior, and dock behavior for primary routes.

#### Scenario: Primary route renders
- **WHEN** homepage, login, dashboard, Interactive Learning, Arena, Control Workbench, knowledge graph, data center, teacher, admin, or report route renders
- **THEN** the route SHALL resolve its navigation layers from central inventory
- **AND** page-local navigation lists SHALL NOT override central role and journey semantics.

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
