## ADDED Requirements

### Requirement: Projection carries independently governed learning collections
The AI Workshop student-safe projection SHALL include tasks, milestones, achievements, experiments, and journals as independently governed collection envelopes. Each envelope SHALL preserve its own source state, known total, bounded student-safe items, limitation, and adjacent action.

#### Scenario: Projection contains records from mixed source states
- **WHEN** some collection sources return eligible records, some confirm no records, and another source is unavailable
- **THEN** the serialized projection SHALL preserve the corresponding `available`, `empty`, and `unavailable` states independently
- **AND** it SHALL NOT derive one collection's total or items from the overall learner portrait state.

#### Scenario: Projection is serialized into the AI Workshop page
- **WHEN** the server passes governed collections to the client
- **THEN** every item SHALL contain only the stable identity, display fields, status, provenance label, time, and navigation data allowed by its collection contract
- **AND** raw evidence payloads, internal reason codes, unrestricted source references, and other learners' data SHALL remain absent.

#### Scenario: Collection source is unavailable
- **WHEN** a collection read fails or cannot establish eligibility
- **THEN** the envelope total SHALL be unknown rather than zero
- **AND** the projection SHALL include a student-facing limitation and recovery or adjacent action.
