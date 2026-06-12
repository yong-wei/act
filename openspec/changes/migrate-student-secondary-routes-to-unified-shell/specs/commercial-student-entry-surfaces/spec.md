## MODIFIED Requirements

### Requirement: Public and learning entries use one premium map
The system SHALL render homepage, login, Interactive Learning, course catalog, course entry, and simulation hub as one coherent premium entry family.

#### Scenario: Student moves from homepage to learning entry
- **WHEN** a student opens homepage, Interactive Learning, course catalog, or simulation hub
- **THEN** the visible hierarchy SHALL preserve the same brand language, intent grouping, route frame, theme behavior, and cockpit/account semantics
- **AND** Interactive Learning and course catalog SHALL use the unified AppShell or approved shell resolved from route inventory
- **AND** the page SHALL NOT fall back to unrelated generic card-grid styling or page-local topbar navigation.

## ADDED Requirements

### Requirement: Interactive Learning first-hop destinations keep the entry shell
Interactive Learning first-hop student destinations SHALL remain in the same learning-atlas navigation family as the entry page.

#### Scenario: Student follows an Interactive Learning entry action
- **WHEN** a student opens chapter components or cross-domain exploration from the Interactive Learning entry page
- **THEN** the destination SHALL preserve learning-atlas shell behavior, route trace, and adjacent learning navigation
- **AND** the destination SHALL NOT fall back to page-local topbar navigation unless the route ledger records a narrow active exception.
