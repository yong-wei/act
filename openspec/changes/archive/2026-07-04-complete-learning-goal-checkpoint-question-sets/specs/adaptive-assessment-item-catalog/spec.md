## ADDED Requirements

### Requirement: Path-ready LearningGoals have minimum reviewed assessment item sets
The assessment item catalog SHALL provide minimum reviewed, path-eligible assessment item coverage for each current path-ready LearningGoal before the goal is treated as fully testable.

#### Scenario: LearningGoal coverage is evaluated
- **WHEN** the coverage matrix is generated for a path-ready LearningGoal
- **THEN** it SHALL report required and available path-eligible item counts for precheck or readiness, practice, checkpoint, and remediation stages
- **AND** it SHALL report K/A/Q objective coverage, graph-node coverage, difficulty distribution, cognitive-level distribution, source mix, remediation coverage, blockers, and limitation reasons.

#### Scenario: Minimum coverage is satisfied
- **WHEN** a LearningGoal has at least the configured reviewed path-eligible item counts for every required stage
- **THEN** the coverage matrix SHALL mark the LearningGoal assessment coverage as complete for those stages
- **AND** the items counted SHALL have current human semantic review decisions and valid source hashes.

#### Scenario: Minimum coverage is incomplete
- **WHEN** a LearningGoal lacks required reviewed items for a stage
- **THEN** the coverage matrix SHALL mark the stage incomplete
- **AND** path planning SHALL receive a limitation rather than treating generated, template, unreviewed, or deprecated items as coverage.

### Requirement: Existing question sources are reused or explicitly rejected
The platform SHALL review existing question sources before authoring new adaptive checkpoint items.

#### Scenario: Existing item is suitable
- **WHEN** a preset, Prisma `Question`, AC-Q static, iCourse objective-bank, or K/A/Q foundation-bank item satisfies the LearningGoal and stage policy after human review
- **THEN** it MAY count toward the minimum item set
- **AND** its source lineage and review audit SHALL remain visible.

#### Scenario: Existing item is unsuitable
- **WHEN** an existing item is too broad, ambiguous, duplicated, open-ended without rubric, or disconnected from the LearningGoal policy
- **THEN** it SHALL remain registered as rejected, deprecated, or blocked
- **AND** it SHALL NOT count toward minimum reviewed coverage until rewritten and re-reviewed.
