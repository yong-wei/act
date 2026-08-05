## ADDED Requirements

### Requirement: Correction candidates accept auditable student decisions
The system SHALL let the owner of a path confirm, reject, or defer a current correction candidate through a server-authoritative decision. Each decision SHALL persist the candidate fingerprint, path version, original-path snapshot, candidate snapshot, supporting facts, decision type, timestamp, and application result. The client SHALL submit only candidate identity, path version, decision type, and an idempotency key.

#### Scenario: Student defers a current candidate
- **WHEN** the owner defers a current available candidate with matching candidate and path versions
- **THEN** the system SHALL append a deferred decision without modifying the path
- **AND** the journey SHALL show that the candidate is deferred while allowing a later decision on that same candidate.

#### Scenario: Student rejects a current candidate
- **WHEN** the owner rejects a current available candidate with matching candidate and path versions
- **THEN** the system SHALL append a rejected decision without modifying the path
- **AND** the journey SHALL retain the decision in history and SHALL NOT actively offer the same candidate again.

#### Scenario: Student confirms a current candidate
- **WHEN** the owner confirms a current available candidate with matching candidate and path versions
- **THEN** the system SHALL append a confirmed decision and apply only its eligible future unfinished nodes
- **AND** it SHALL preserve current entered work, completed nodes, execution records, deviations, interventions, and the original snapshot.

#### Scenario: Decision request is replayed
- **WHEN** an owner repeats a decision request with the same path and idempotency key
- **THEN** the system SHALL return the original authoritative decision result
- **AND** it SHALL NOT append another decision or apply the candidate twice.

### Requirement: Correction decisions reject stale candidates and concurrent path writes
The system SHALL rederive the candidate and verify both its fingerprint and the persisted path version before recording or applying a decision. The system SHALL NOT accept a client-supplied node sequence, evidence payload, or partial merge.

#### Scenario: Candidate or path is stale
- **WHEN** the candidate fingerprint differs from the current server-derived candidate or the path version no longer matches
- **THEN** the system SHALL return a conflict response with a refresh action
- **AND** it SHALL not create a decision or mutate the path.

#### Scenario: Concurrent update wins first
- **WHEN** another path write changes the authoritative path after a decision was read but before it is applied
- **THEN** the decision write SHALL fail as a conflict
- **AND** it SHALL not overwrite the concurrent update.

### Requirement: Journey exposes correction decision state and history
The student-facing journey SHALL expose the current candidate's decision state and a privacy-safe decision history. A rejected candidate SHALL remain auditable without being offered as a new correction; a newly derived candidate with a different fingerprint SHALL remain eligible for a new decision.

#### Scenario: Rejected candidate is revisited
- **WHEN** the journey rederives the same fingerprint after a rejection
- **THEN** it SHALL show the rejection in history
- **AND** it SHALL not render confirm, reject, or defer actions for that candidate.

#### Scenario: New candidate replaces prior candidate
- **WHEN** changed path facts produce a different candidate fingerprint after an earlier decision
- **THEN** the journey SHALL expose the new candidate as independently actionable
- **AND** it SHALL retain the earlier decision in history.
