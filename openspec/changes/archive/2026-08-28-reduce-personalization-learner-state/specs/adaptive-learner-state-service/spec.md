## ADDED Requirements

### Requirement: Existing learner-state contract is implemented through read ports

The existing `adaptive-learner-state-service` contract SHALL be satisfied by a server-owned application boundary that obtains Learning Record and Assessment inputs through read ports and delegates calculation to the pure Personalization reducer. Direct database assembly inside the public service SHALL not remain authoritative.

#### Scenario: Existing API reads learner state

- **WHEN** the adaptive learner-state route or an authorized consumer requests state
- **THEN** it SHALL receive the canonical portrait, mastery, path context, confidence, freshness and privacy projection from the new boundary
- **AND** it SHALL not pass Prisma or client-authored identity into the reducer.

#### Scenario: Old service entry is removed

- **WHEN** every production caller has been migrated and the zero-import gate passes
- **THEN** the old service authority and any forwarding export SHALL be deleted
- **AND** historical snapshots and other-domain tables SHALL remain readable through their owning adapters.
