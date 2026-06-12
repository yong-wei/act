## ADDED Requirements

### Requirement: Secondary route governance metadata is complete
Representative secondary routes and first-hop Interactive Learning destinations SHALL expose governance-testable metadata without redefining route-inventory ownership.

#### Scenario: Governance checks a representative secondary route
- **WHEN** Arena, Control Workbench, Interactive Learning, course catalog, chapter components, cross-domain exploration, adaptive practice, knowledge graph, or Data Center route evidence is generated
- **THEN** the evidence SHALL record shell type, role scope, expected entries, forbidden entries, collapse behavior, local panels, theme support, and mobile behavior
- **AND** the evidence SHALL identify whether the route is migrated, blocked by an upstream change, or covered by a narrow active exception.

### Requirement: Secondary route governance rejects journey breaks
Secondary route governance SHALL reject migrated routes that send the next student action into an ungoverned navigation language.

#### Scenario: Student follows a route's primary next action
- **WHEN** a migrated student secondary route exposes a primary next action
- **THEN** the destination SHALL stay within the unified navigation family or have a route-ledger exception with owner and removal condition
- **AND** migrated entry routes SHALL NOT be accepted if their first student action falls back to page-local topbar navigation.
