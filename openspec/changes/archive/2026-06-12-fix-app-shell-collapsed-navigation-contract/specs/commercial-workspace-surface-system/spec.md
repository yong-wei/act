## MODIFIED Requirements

### Requirement: Workspace shell supports collapsible navigation
The system SHALL provide a unified workspace shell pattern for dense student workspaces with desktop expanded navigation, desktop collapsed navigation, sticky breadcrumb header, personal-center account action, and mobile drawer navigation.

#### Scenario: Desktop workspace shell expands and collapses
- **WHEN** a student opens a migrated workspace on a desktop-width viewport
- **THEN** the left navigation SHALL be available in expanded and collapsed states
- **AND** the collapsed state SHALL preserve route navigation through icons, accessible names, focus order, and active route indication
- **AND** the collapsed state SHALL reserve only the approved narrow navigation rail width rather than the expanded sidebar width
- **AND** collapsed navigation items SHALL NOT display duplicated or ambiguous abbreviated text
- **AND** the main workspace area SHALL expand without horizontal overflow.

#### Scenario: Mobile workspace shell uses a drawer
- **WHEN** a student opens a migrated workspace at 320px width
- **THEN** global workspace navigation SHALL move into an explicit drawer or sheet control
- **AND** the primary task content SHALL remain reachable without reading through all navigation entries.
