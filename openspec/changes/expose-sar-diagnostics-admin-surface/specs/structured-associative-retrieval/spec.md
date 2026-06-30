## MODIFIED Requirements

### Requirement: SAR exposes diagnostics and evaluation traces
The system SHALL expose privacy-safe diagnostics for SAR projection and query behavior through service payloads and administrator-visible governance surfaces.

#### Scenario: Administrator reviews SAR health
- **WHEN** an administrator opens SAR diagnostics or requests the SAR report payload
- **THEN** the system SHALL expose event count, entity count, relation count, source type counts, privacy scope counts, query trace summaries, hop counts, privacy rejection counts, limitation counts, and downstream verified citation rate where available.

#### Scenario: SAR trace is serialized
- **WHEN** a SAR query trace is persisted, displayed, or exported
- **THEN** the trace SHALL include seed entities, expanded entities, selected events, rejected refs, limitations, version refs, and downstream citation/source-pack handoff state
- **AND** it SHALL omit raw private evidence and hidden internals.

#### Scenario: SAR diagnostics are rendered for administrators
- **WHEN** an administrator inspects SAR diagnostics in a governance UI
- **THEN** the rendered report SHALL use the same privacy-safe summaries and redacted trace fields as the service payload
- **AND** it SHALL distinguish SAR candidate refs from verified citation outcomes.
