## ADDED Requirements

### Requirement: Candidate authoritative projection is isolated from Legacy projection
The projection layer MUST expose `act.canvas.v2` and `act.node-detail.v2` as contracts derived from one selected candidate ReleaseSet, and MUST keep the existing Legacy projection unchanged during migration.

#### Scenario: Candidate projection is requested
- **WHEN** the client requests a specific candidate ReleaseSet
- **THEN** the projection SHALL contain only objects and relations from that ReleaseSet and SHALL identify its projection version

#### Scenario: Legacy projection is requested
- **WHEN** the migration-period client selects the old graph
- **THEN** the existing Legacy DTO SHALL be returned without Canonical candidate objects
