## ADDED Requirements

### Requirement: Arena KAQ writeback shall be persistently materialized
Accepted official Arena submissions SHALL produce an idempotent persisted learning-evidence writeback outcome.

#### Scenario: an official Arena submission is accepted
- **WHEN** an official Arena submission is accepted for a student and maps to valid KAQ targets
- **THEN** the system SHALL materialize a persisted writeback outcome with source submission, student, KAQ refs, artifact version, status, confidence, and limitation codes.
- **AND** repeating the same accepted submission SHALL NOT create duplicate learning facts.

#### Scenario: an Arena attempt is late, zero, invalid, duplicate-only, or unmapped
- **WHEN** an Arena attempt is late, zero, invalid, duplicate-only, unauthorized, or lacks valid KAQ mapping
- **THEN** the system SHALL persist or expose a blocked/degraded outcome and SHALL NOT create positive mastery evidence.

### Requirement: Arena writeback consumers shall share one outcome
Student feedback, teacher reports, evidence timelines, path planning, and assistant context SHALL read the same Arena writeback outcome.

#### Scenario: a consumer displays Arena evidence
- **WHEN** a student, teacher, planner, or assistant context reads Arena learning evidence
- **THEN** it SHALL use the persisted writeback outcome and SHALL NOT recompute a conflicting status from UI-only projection.

#### Scenario: writeback is pending or degraded
- **WHEN** materialization is pending, degraded, or blocked
- **THEN** every consumer SHALL show consistent status language and limitation reason.

### Requirement: Arena writeback audit closure shall be evidence backed
Arena evidence writeback findings SHALL be closed only with linked implementation evidence.

#### Scenario: audit report is updated
- **WHEN** this change updates the Product Design audit report
- **THEN** every closed finding id SHALL reference tests, persisted outcome evidence, and residual scope.
