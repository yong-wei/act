## ADDED Requirements

### Requirement: Typecheck signal is restored before dependency upgrades
The project SHALL restore the TypeScript no-emit gate before using it to validate dependency or framework upgrades.

#### Scenario: Typecheck gate is run on the migration branch
- **WHEN** `npx tsc --noEmit --pretty false` is executed
- **THEN** stale route parameter fixtures, runtime field fixtures, mock generic signatures, and compiler target/lib mismatches SHALL be repaired or classified as real blockers
- **AND** the command SHALL provide a meaningful regression signal for future package changes.
