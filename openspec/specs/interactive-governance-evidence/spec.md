# interactive-governance-evidence Specification

## Purpose
Define durable evidence, scoring, and reporting requirements for interactive classroom submissions so post-class governance can reconstruct answer attempts, materialize objective quiz facts, and audit class session counts from stored tables.
## Requirements
### Requirement: Interactive submissions preserve answer evidence
The system SHALL persist submitted interactive lesson answers in immutable submission records, including enough data to reconstruct each submitted attempt without reading mutable student state.

#### Scenario: Quiz-card submit stores answer payload
- **WHEN** a student submits a quiz-card or quiz-group response during an interactive classroom session
- **THEN** the corresponding `StudentStepResponse` SHALL include the submitted card ids, selected values, lesson key, step id, attempt key, client event id, and source log id in its durable response data
- **AND** the stored response data SHALL be sufficient to calculate per-card correctness after the session.

#### Scenario: Repeated submits preserve attempts
- **WHEN** a student submits the same step more than once
- **THEN** each attempt SHALL remain distinguishable by attempt key or client event id
- **AND** later submissions SHALL NOT overwrite the evidence payload for earlier `StudentStepResponse` records.

#### Scenario: Mutable state is not the only answer source
- **WHEN** post-class analysis queries submitted quiz answers
- **THEN** it SHALL be able to use `StudentStepResponse` as the source of truth
- **AND** it SHALL NOT require `StudentState.data.responses` to recover the submitted answer values.

### Requirement: Objective quiz facts carry scoring evidence
The system SHALL convert objective interactive quiz submissions into LearningFacts with score and correctness context derived from the submitted payload and lesson contract.

#### Scenario: Correct quiz answers produce scored facts
- **WHEN** a submitted objective quiz response can be matched to manifest or contract reference answers
- **THEN** the generated LearningFact SHALL include a non-null normalized score
- **AND** its context SHALL include per-card correctness, answered count, correct count, lesson key, step id, and attempt identity.

#### Scenario: Unsupported quiz scoring is explicit
- **WHEN** a submitted interaction cannot be scored because the lesson contract lacks objective answer keys
- **THEN** the generated LearningFact SHALL mark scoring as unsupported in context
- **AND** it SHALL NOT silently store a zero score that looks like a failed answer.

#### Scenario: Session finalization fact remains separate
- **WHEN** a session finalization event is converted into a LearningFact
- **THEN** it SHALL remain distinguishable from per-step quiz facts
- **AND** it SHALL NOT distort per-step quiz score summaries.

### Requirement: Class reports use auditable evidence counts
The system SHALL generate class session reports whose counts can be reproduced from stored evidence tables and whose count policies are explicit.

#### Scenario: Report names source counts
- **WHEN** a ClassSessionReport is generated for an interactive lesson
- **THEN** report data SHALL identify counts for raw interaction logs, deduplicated sync-error incidents, submitted participants, LearningFact participants, state participants, and snapshot-updated participants
- **AND** each count SHALL state or imply the source table or source policy used to compute it.

#### Scenario: Report submission count matches durable submissions
- **WHEN** a report states the number of submitted participants or submitted attempts
- **THEN** those numbers SHALL be reproducible from `StudentStepResponse` for the session
- **AND** any final-state answer summary SHALL be labeled separately from attempt-level submission counts.

#### Scenario: Snapshot update window is explicit
- **WHEN** a report states snapshot-updated participants
- **THEN** it SHALL include the snapshot update window used for that calculation
- **AND** the participant population used for the denominator SHALL be explicit.

### Requirement: Sync-error bursts are de-duplicated for governance summaries
The system SHALL preserve raw sync-error telemetry while preventing retry bursts from inflating class-wide activity summaries.

#### Scenario: Repeated sync errors become one incident
- **WHEN** the same user emits repeated sync-error events for the same session and step inside a short burst window
- **THEN** the governance summary SHALL count them as one deduplicated sync-error incident
- **AND** the raw sync-error event count SHALL remain available for debugging.

#### Scenario: Sync-error users remain visible
- **WHEN** sync errors occur during a live classroom session
- **THEN** the report SHALL include the number of affected users
- **AND** the report SHALL make concentrated error bursts distinguishable from broad class-wide failure.

#### Scenario: Non-error activity is not reduced by sync-error de-duplication
- **WHEN** sync-error burst handling is applied
- **THEN** view, leave, submit, complete, and other non-error events SHALL retain their original evidence counts
- **AND** LearningFact generation SHALL remain driven by high-value submit or completion evidence rather than by sync errors.

### Requirement: Interactive evidence participates in unified governance
Interactive classroom and standalone interactive evidence SHALL be classified through the unified learning evidence catalog before profile, report, or recommendation consumers rely on it.

#### Scenario: Interactive evidence is cataloged
- **WHEN** interactive classroom or standalone interactive events are inspected for governance
- **THEN** the system SHALL classify each event family by source table, canonical event type, evidence value level, profile eligibility, and traceability fields
- **AND** the classification SHALL preserve the existing durable submission and report requirements for `StudentStepResponse`, `InteractionLog`, and `LearningFact`.

#### Scenario: Interactive evidence uses canonical event type
- **WHEN** interactive event rows use legacy wrapper types such as `view`, `interact`, `submit`, or `complete`
- **THEN** governance consumers SHALL resolve the canonical type from the payload when present
- **AND** classroom and standalone evidence SHALL not be undercounted because only the wrapper type was inspected.

#### Scenario: Interactive profile contribution follows value policy
- **WHEN** interactive evidence is used for student profile or recommendation features
- **THEN** high-value submissions and completions SHALL be eligible for competency contribution
- **AND** low-value views or navigation SHALL remain activity context unless an explicit contribution rule exists.

### Requirement: Shared control workbench evidence is recorded
Interactive course use of shared control workbench capabilities SHALL generate backend evidence comparable to ordinary activity submissions.

#### Scenario: Student submits after workbench exploration
- **WHEN** a student submits a response from a course-embedded shared control workbench
- **THEN** the submission evidence SHALL include event type, client event id, attempt key, trusted source log id, lesson key, step id, module id, component kind, component id, actor role, client event time, schema version, payload, capability id, visible panel ids, parameter snapshot, derived result references, answer payload, and server timestamp
- **AND** the evidence SHALL be queryable by teacher diagnostics.

#### Scenario: Workbench evidence is classified
- **WHEN** a course-embedded workbench records exploration or submission evidence
- **THEN** the evidence contract SHALL classify the event as `InteractionLog` only, `StudentStepResponse`, or `LearningFact` materialization input
- **AND** the classification SHALL define whether the event can affect teacher diagnostics, ability snapshots, or recommendation inputs.

#### Scenario: Teacher reviews workbench diagnostics
- **WHEN** the teacher opens diagnostics for a course-embedded workbench module
- **THEN** the system SHALL show submitted count, viewed count, release state, parameter exploration coverage, and common judgment outcomes
- **AND** it SHALL NOT expose student input controls or implementation-only field names.

#### Scenario: Workbench diagnostics are aggregated
- **WHEN** teacher diagnostics summarize a course-embedded workbench module
- **THEN** the diagnostic contract SHALL define denominator, dedupe key, latest-vs-all-attempt policy, resubmission display, unreleased-student inclusion, and free-text redaction policy
- **AND** diagnostic routes and APIs SHALL be accessible only to teacher or admin roles.

