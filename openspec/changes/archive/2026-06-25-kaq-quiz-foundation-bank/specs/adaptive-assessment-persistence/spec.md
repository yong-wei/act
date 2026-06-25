## ADDED Requirements

### Requirement: K/A/Q quiz metadata persists with adaptive assessment attempts
The system SHALL persist adaptive assessment sessions and answers instead of relying on process memory.

#### Scenario: K/A/Q question metadata is persisted
- **WHEN** a reviewed or generated adaptive question is selected or answered
- **THEN** the durable item reference SHALL preserve LearningGoal ids, K/A/Q objective ids, knowledge node ids, capability target ids, quality target ids, difficulty, cognitive level, purpose, misconception tags, outcome refs, remediation refs, review state, content hash, and version metadata where available
- **AND** historical answers SHALL continue to use the immutable metadata snapshot used at answer time.

#### Scenario: Generated question is provisional
- **WHEN** a generated question lacks human-reviewed K/A/Q and readiness metadata
- **THEN** its answer MAY be persisted for practice history
- **AND** it SHALL NOT unlock high-complexity resources, satisfy terminal validation, or create high-confidence mastery evidence.

### Requirement: K/A/Q quiz evidence enters governed learning facts
The system SHALL materialize adaptive assessment outcomes into governed learning evidence.

#### Scenario: Reviewed quiz outcome is finalized
- **WHEN** a reviewed quiz item produces a scored outcome
- **THEN** governed evidence SHALL include question snapshot id, quiz set id, attempt/session ids where available, scoring version, rubric version where applicable, denominator, retry policy, event source, event type, client event id where available, source log id, dedupe key, started/submitted/graded timestamps, objective refs, graph refs, capability targets, outcome refs, confidence, LearningFact eligibility, StudentCompetencySnapshot effect, and remediation links
- **AND** raw answer bodies and full question text SHALL remain outside ordinary learner-state payloads.

#### Scenario: Quiz evidence is under-reviewed
- **WHEN** a generated or under-reviewed quiz item is answered
- **THEN** the persisted evidence SHALL carry provisional status and degraded confidence
- **AND** it SHALL NOT update high-confidence mastery, unlock high-complexity resources, or satisfy terminal validation.
