## ADDED Requirements

### Requirement: Ingestion implementation simplification cannot change the event protocol
Simplifying ingestion SHALL preserve the existing registered discriminator/schema, source and dedupe identity, immutable anchor set, trusted temporal fields, privacy allowlist, retention/replay rules and compatibility behavior. No second event contract or inferred identity MAY be introduced.

#### Scenario: Registered event is processed after refactoring
- **WHEN** an existing supported event reaches the simplified pipeline
- **THEN** it SHALL resolve the same contract, authority, privacy policy, anchors, timestamps and effective result
- **AND** unknown schema/version behavior SHALL remain fail-closed

#### Scenario: Legacy input is replayed
- **WHEN** an authorized legacy adapter supplies an input to the simplified ingestion path
- **THEN** its original provenance and decoder/materializer versions SHALL remain explicit
- **AND** changing a decoder or revision SHALL still require explicit rematerialization or rebase
