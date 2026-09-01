# ai-workshop-evidence-projection Specification

## Purpose

Define the server-owned, student-safe learner-evidence projection that drives
AI Workshop personalization without synthetic profile data or restricted
evidence exposure.
## Requirements
### Requirement: AI Workshop projection is server-owned
The AI Workshop SHALL receive learner evidence metadata derived from the authenticated learner's server-owned adaptive learner state.

#### Scenario: Authenticated learner opens the AI Workshop
- **WHEN** the `/ai` server page renders for an authenticated learner
- **THEN** it SHALL read learner state using the session user id and pass a serializable student-safe projection to the client
- **AND** query parameters SHALL NOT provide the authoritative learner identity or evidence values.

### Requirement: Projection exposes explicit evidence status
The projection SHALL distinguish available, empty, and unavailable learner evidence states.

#### Scenario: Learner has no governed evidence
- **WHEN** the learner state has no governed evidence and no current portrait
- **THEN** the projection SHALL be `empty`
- **AND** it SHALL NOT contain synthetic scores, durations, achievements, tasks, or recommendations.

#### Scenario: Learner state cannot be served
- **WHEN** the learner-state service is disabled, unavailable, or fails closed
- **THEN** the projection SHALL be `unavailable`
- **AND** the client SHALL receive a student-facing limitation and recovery action.

#### Scenario: Learner has partial or stale evidence
- **WHEN** governed evidence exists but is partial, stale, or low confidence
- **THEN** the projection SHALL remain evidence-backed
- **AND** it SHALL preserve the limitation markers for student-facing display.

### Requirement: Projection does not expose restricted evidence
The projection SHALL contain only fields allowed for the student-facing AI Workshop and SHALL exclude raw audit payloads, internal reason codes, and unrestricted source references.

#### Scenario: Projection is serialized into the page
- **WHEN** the server serializes the AI Workshop projection
- **THEN** it SHALL include status, evidence count, confidence, source coverage, portrait availability, path summary, and student-safe limitations
- **AND** it SHALL NOT include raw evidence payloads or system-internal privacy fields.

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

