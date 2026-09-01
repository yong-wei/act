## ADDED Requirements

### Requirement: Formula projections are sealed with bounded shard objects
The shard manifest SHALL bind each materialized Formula presentation to the current formula-render artifact, locale profile and public projection digest. Domain, search and neighborhood responses SHALL include only projections for objects present in that response.

#### Scenario: Formula projection drifts
- **WHEN** a Formula render hash, locale profile or shard object identity differs from the sealed manifest
- **THEN** the response SHALL fail closed before reaching the client
- **AND** it SHALL not load a global formula index or another version to repair the mismatch
