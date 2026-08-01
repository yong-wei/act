## ADDED Requirements

### Requirement: Adaptive diagnosis uses immutable answer-time snapshots
The system SHALL persist the server-verifiable question facts required to explain an adaptive answer without reading mutable in-memory or live-catalog question content.

#### Scenario: A new adaptive answer is persisted
- **WHEN** a student submits an adaptive answer
- **THEN** the immutable item reference SHALL snapshot the prompt, option keys and explanations, correct option, system explanation, knowledge tags, misconception tags, and approved remediation targets
- **AND** the complete snapshot SHALL participate in the item-reference content hash
- **AND** an existing item-reference snapshot SHALL NOT be overwritten.

#### Scenario: A historical answer lacks a supported snapshot
- **WHEN** diagnosis is requested for an answer created without a valid `adaptive-question-snapshot.v1`
- **THEN** the diagnosis context SHALL be unavailable with an explicit compatibility error
- **AND** the system SHALL NOT reconstruct answer-time truth from the current catalog or client input.

#### Scenario: Reviewed remediation is snapshotted
- **WHEN** an approved human-review decision contains remediation references
- **THEN** each accepted reference SHALL resolve through the governed resource registry to its canonical title and render target
- **AND** provisional, locked, unresolved, or synthesized resource targets SHALL NOT enter the diagnosis snapshot.
