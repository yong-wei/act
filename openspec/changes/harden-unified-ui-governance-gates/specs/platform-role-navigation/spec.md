## ADDED Requirements

### Requirement: Route ledger exposes governance inputs
The central route ledger SHALL expose the metadata needed by unified UI governance gates.

#### Scenario: Governance reads the route ledger
- **WHEN** commercial UI governance evaluates a primary route
- **THEN** it SHALL be able to read archetype, owning change, temporary exception, legacy alias, legacy shell disposition, theme support, dock behavior, navigation layers, and visual QA profile from central route metadata
- **AND** governance SHALL not depend on scattered page-local declarations for those fields.
