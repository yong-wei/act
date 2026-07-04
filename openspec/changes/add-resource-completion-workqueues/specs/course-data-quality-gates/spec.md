## ADDED Requirements
### Requirement: Resource completion helper emits claimable workqueues
The data completeness helper SHALL emit stable workqueues for staged human completion of resource metadata and semantic review.

#### Scenario: Workqueues are generated
- **WHEN** the helper evaluates graph, resource, citation, path-planning, assessment, evidence-lineage, and learner fixture readiness
- **THEN** it SHALL emit machine-readable workqueues grouped by source family, LearningGoal, graph domain, missing-field code, primary follow-up bucket, and dependency state
- **AND** every workqueue item SHALL include stable resource id, source family, current blockers, suggested reviewer action, version or source hash where available, and privacy-minimized display fields.

#### Scenario: Workqueue totals reconcile
- **WHEN** reviewer-facing queues are emitted
- **THEN** queue totals SHALL reconcile with helper layer totals, follow-up bucket counts, and field-completion audit totals
- **AND** a resource SHALL appear in one primary completion queue unless a secondary dependent queue is explicitly marked.

#### Scenario: Human-confirmed rows are integrity checked
- **WHEN** helper output marks semantic fields as human-confirmed
- **THEN** the helper SHALL require reviewer identity, reviewer role, reviewed time, source hash or source version, reviewer-visible rationale, and separate human-review evidence where applicable
- **AND** script constants, generated suggestions, placeholder reviewer ids, or missing source-version evidence SHALL NOT satisfy fresh human review.
