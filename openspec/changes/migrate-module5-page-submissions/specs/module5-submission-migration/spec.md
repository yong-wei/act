## ADDED Requirements

### Requirement: Module 5 response pages use shared submission evidence
The system SHALL route every response-producing page in 5-2 and later module 5 interactive lessons through the shared manifest submission evidence path.

#### Scenario: Objective activity page submits through shared path
- **WHEN** a student submits an objective activity card in 5-2, 5-3, 5-4, 5-5, or 5-6
- **THEN** the submission MUST use the shared evidence path
- **AND** the persisted evidence MUST include submitted answer values and scoring metadata when reference answers exist.

#### Scenario: Subjective activity page submits through shared path
- **WHEN** a student submits a text or reflection response in 5-2 or later module 5 lessons
- **THEN** the submission MUST use the shared evidence path
- **AND** the persisted evidence MUST include answer digest and subjective completeness markers.

#### Scenario: Custom panel evidence is preserved
- **WHEN** a response-producing parameter, simulation, or training panel submits a result
- **THEN** the result MUST be included as structured extra evidence associated with the step and panel
- **AND** the course MUST NOT rely only on mutable student state for that result.

### Requirement: Migration coverage is enforceable
The system SHALL provide a test or static guard that enumerates module 5 response-producing pages and verifies migration coverage.

#### Scenario: Unmigrated page fails guard
- **WHEN** a module 5 response-producing step bypasses the shared submission path
- **THEN** the migration guard MUST fail with the lesson and step identifier
- **AND** the failure MUST identify the missing shared submission integration.
