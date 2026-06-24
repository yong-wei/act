## ADDED Requirements

### Requirement: Reviewed quiz coverage constrains readiness and personalization
The adaptive path planner SHALL use reviewed quiz coverage and governed quiz outcomes before treating a LearningGoal as fully testable, personalized, or ready for high-complexity unlocks.

#### Scenario: Diagnostic quiz coverage exists
- **WHEN** a learner requests a path for a LearningGoal with reviewed diagnostic quiz coverage
- **THEN** the planner MAY include a precheck or evidence-gathering quiz early in the path
- **AND** the quiz SHALL expose governed outcome refs suitable for later personalization.

#### Scenario: Quiz unlocks a high-complexity resource
- **WHEN** quiz evidence is used to unlock simulation, Arena, control workbench validation, project, or terminal checkpoint nodes
- **THEN** the unlock SHALL require reviewed K/A/Q question metadata and governed outcome refs
- **AND** generated-only or provisional quiz evidence SHALL not satisfy the readiness gate.

#### Scenario: LearningGoal quiz coverage is insufficient
- **WHEN** a LearningGoal lacks reviewed diagnostic or checkpoint quiz coverage required by its policy
- **THEN** the planner SHALL expose a coverage limitation
- **AND** it SHALL not present the LearningGoal as fully testable or high-confidence personalized.

#### Scenario: Quiz outcome materialization is incomplete
- **WHEN** quiz evidence lacks question snapshot, attempt key, scoring version, denominator, dedupe key, confidence, or LearningFact eligibility fields
- **THEN** the planner SHALL treat the result as insufficient for readiness and terminal validation
- **AND** it SHALL preserve the attempt only as limited practice history.
