## ADDED Requirements

### Requirement: Assessment baseline completion proceeds through bounded shards
LearningGoal assessment baseline completion SHALL support deterministic shards so implementing agents can complete semantic review without claiming the entire assessment backlog.

#### Scenario: Assessment shard is selected
- **WHEN** assessment coverage output shows missing diagnostic, practice, checkpoint, remediation, or terminal-validation-support stages
- **THEN** the implementation SHALL select a deterministic shard from the lowest-completeness LearningGoal/stage cells
- **AND** the shard SHALL record selected item ids, selected LearningGoal/stage cells, source-family totals, and residual unselected counts.

#### Scenario: Assessment shard is reviewed
- **WHEN** a selected item is counted toward a LearningGoal stage
- **THEN** it SHALL have implementing-agent item-by-item semantic review against source question content, answer or rubric context, LearningGoal fit, K/A/Q objective ids, graph-node refs, difficulty, cognitive level, misconception or remediation relation, source hash, and reviewer-visible rationale
- **AND** script-generated or model-suggested fields SHALL remain suggestions until the review decision is recorded.

#### Scenario: Assessment shard remains incomplete
- **WHEN** selected shard rows cannot satisfy a stage
- **THEN** the coverage matrix SHALL report an explicit limitation for that shard cell
- **AND** unselected rows SHALL remain in the assessment workqueue rather than blocking unrelated fixture data completion.
