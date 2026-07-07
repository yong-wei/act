## ADDED Requirements

### Requirement: Assessment item semantic coverage is gated
The course data-quality gates SHALL report assessment item semantic coverage before items are used for adaptive path readiness or checkpoints.

#### Scenario: Semantic gate runs
- **WHEN** assessment item governance checks run
- **THEN** they SHALL report missing review decisions, missing LearningGoal bindings, missing K/A/Q objective ids, missing graph-node refs, missing difficulty or cognitive level, missing misconception/remediation refs, stale source hashes, and invalid path eligibility
- **AND** they SHALL fail or block path eligibility according to the configured severity.

#### Scenario: Item is unreviewed
- **WHEN** an item is registered but lacks a valid manual semantic review decision
- **THEN** the gate SHALL keep it visible in backlog output
- **AND** it SHALL NOT allow the item to satisfy readiness, checkpoint, remediation gate, or terminal-validation requirements.
