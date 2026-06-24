## ADDED Requirements

### Requirement: Route ledger exposes governance inputs
The central route ledger SHALL expose the metadata needed by unified UI governance gates.

#### Scenario: Governance reads the route ledger
- **WHEN** commercial UI governance evaluates a primary route
- **THEN** it SHALL be able to read archetype, owning change, temporary exception, legacy alias, legacy shell disposition, theme support, dock behavior, navigation layers, and visual QA profile from central route metadata
- **AND** governance SHALL not depend on scattered page-local declarations for those fields.

#### Scenario: Compatibility aliases are reviewed
- **WHEN** a route declares compatibility aliases for migration or callback behavior
- **THEN** those aliases SHALL NOT duplicate another current primary route href in the central route ledger
- **AND** profile sub-routes SHALL remain independent report-ledger routes with role-route-tab mobile navigation rather than compatibility aliases of `/profile`.
