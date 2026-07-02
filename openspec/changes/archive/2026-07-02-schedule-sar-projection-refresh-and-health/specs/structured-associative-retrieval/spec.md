## ADDED Requirements

### Requirement: SAR projection refresh is governed and observable
The system SHALL refresh persisted SAR projections from governed platform sources through an auditable workflow.

#### Scenario: SAR projection refresh runs
- **WHEN** SAR refresh is triggered automatically or manually
- **THEN** the system SHALL project governed K/A/Q graph, LearningGoal, ResourceNode, evidence corpus, LearningFact summary, simulation, Arena, and path summary sources through the SAR projection contract
- **AND** persisted SAR records SHALL be updated idempotently without copying restricted raw content.

#### Scenario: SAR source is stale or failed
- **WHEN** a source family cannot be refreshed or its source version is stale
- **THEN** SAR health SHALL record source family, stale or failed state, last attempted refresh, last successful refresh where available, limitation code, and retry status.

#### Scenario: Arena source is refreshed
- **WHEN** SAR refresh projects Arena evidence, summaries, or evaluation context
- **THEN** official score, validity, ranking, attempt policy, and evaluation metrics SHALL be sourced only from persisted ArenaSubmission or official evaluation run records
- **AND** LearningFact, SAR trace, KAQ writeback, or learner evidence summaries SHALL remain auxiliary learning evidence context, not official Arena result truth.

## MODIFIED Requirements

### Requirement: SAR exposes diagnostics and evaluation traces
The system SHALL expose privacy-safe diagnostics for SAR projection, refresh health, and query behavior through service payloads and administrator-visible governance surfaces.

#### Scenario: Administrator reviews SAR health
- **WHEN** an administrator opens SAR diagnostics or requests the SAR report payload
- **THEN** the system SHALL expose event count, entity count, relation count, source type counts, privacy scope counts, refresh freshness, stale source counts, query trace summaries, hop counts, privacy rejection counts, limitation counts, and downstream verified citation rate where available.
