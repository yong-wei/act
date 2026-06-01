## ADDED Requirements

### Requirement: Unit contract signal is restored before dependency upgrades
The project SHALL restore the unit-test contract gate before using it to validate dependency or framework upgrades.

#### Scenario: Unit gate is run on the migration branch
- **WHEN** `npm run test:unit` is executed
- **THEN** existing interactive manifest, module taxonomy, data-governance, lesson-map, and dynamic-route contract drift SHALL be repaired or classified as real blockers
- **AND** the command SHALL provide a meaningful runtime regression signal for future package changes.
