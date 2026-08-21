## ADDED Requirements

### Requirement: Candidate adjustment persists an immutable derived batch
The system SHALL persist a materially changed candidate adjustment as a new immutable candidate batch linked to the authorized source batch and source candidate, and SHALL preserve the source batch and the learner's selected or executing path unchanged.

#### Scenario: Adjustment produces materially changed candidates
- **WHEN** an authorized learner adjusts a persisted candidate and the planner returns one or more materially changed candidates
- **THEN** the system SHALL persist a new immutable candidate batch
- **AND** the batch SHALL retain its source batch, source candidate, normalized adjustment request, source fingerprint, active-progress version, and server-produced difference summary.

#### Scenario: Derived batch is persisted
- **WHEN** the derived batch is created successfully
- **THEN** the source candidate and source batch SHALL remain unchanged
- **AND** the learner's active path, current node, completion state, deviations, and execution evidence SHALL remain unchanged.

### Requirement: Candidate adjustment uses stable source identity
The system SHALL resolve an adjustment source from server-owned batch and candidate identities and SHALL NOT use a display label, ordinal, title, or page-local option identifier as candidate authority.

#### Scenario: Source candidate belongs to the requested batch
- **WHEN** the learner submits an adjustment with an authorized batch ID and candidate ID
- **THEN** the system SHALL resolve that exact persisted candidate and verify learner and goal scope before planning.

#### Scenario: Source identity is invalid
- **WHEN** the candidate does not belong to the batch or the request supplies only a page-local option identifier
- **THEN** the system SHALL reject the adjustment without generating or persisting a derived batch.

### Requirement: Candidate adjustment reports non-material and stale results honestly
The system SHALL create a successful derived batch only when governed path facts differ materially and SHALL invalidate results whose source or active-progress version no longer matches current server state.

#### Scenario: Adjustment has no material difference
- **WHEN** adjusted candidates preserve the source node identities, node order, and supported path metrics without a material change
- **THEN** the system SHALL return `no_material_difference`
- **AND** it SHALL NOT persist or display a cosmetic successful batch.

#### Scenario: Adjustment result becomes stale
- **WHEN** the source batch, source candidate fingerprint, normalized request identity, or active-progress version changes before completion
- **THEN** the result SHALL be treated as stale
- **AND** it SHALL NOT replace the visible batch, mutate the active path, or create path-choice evidence.
