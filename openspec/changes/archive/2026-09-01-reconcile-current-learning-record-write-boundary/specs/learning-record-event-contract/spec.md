## ADDED Requirements

### Requirement: Boundary reconciliation does not create a second event contract
The write-boundary reconciliation SHALL reuse the existing versioned Learning Record event registry, payload allowlist, source anchors, trusted temporal fields and compatibility adapter. It MUST NOT introduce a parallel discriminator, schema registry, envelope or dedupe authority for the same logical event.

#### Scenario: An existing registered event is reconciled
- **WHEN** a producer is classified during the current-revision write inventory
- **THEN** the reconciliation SHALL reference its existing discriminator, schema, owner, privacy and authority policy
- **AND** it SHALL change only the producer routing or exception record when required

#### Scenario: Internal application call is classified
- **WHEN** a trusted same-transaction use case already invokes canonical ingestion
- **THEN** it SHALL remain an application call rather than being wrapped in a duplicate event
- **AND** its accepted fact SHALL retain the same anchors, times and dedupe semantics
