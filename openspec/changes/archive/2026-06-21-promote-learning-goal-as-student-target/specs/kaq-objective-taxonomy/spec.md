## MODIFIED Requirements

### Requirement: K/A/Q objectives are first-class teaching targets
The system SHALL define knowledge, capability, and quality objectives as canonical teaching targets with stable ids, explicit hierarchy, and LearningGoal usability.

#### Scenario: Objective is used by a LearningGoal
- **WHEN** a K/A/Q objective is referenced by a LearningGoal
- **THEN** the objective SHALL expose stable id, domain, title, hierarchy level, and graph binding data sufficient for LearningGoal validation
- **AND** missing graph binding SHALL be represented as a LearningGoal limitation rather than silently accepted.

#### Scenario: Objective boundary constrains planning
- **WHEN** a planner generates a path for a LearningGoal
- **THEN** the LearningGoal's referenced K/A/Q objectives SHALL define the governed target boundary for resource selection and path explanation
- **AND** planner heuristics SHALL NOT expand the target beyond those objectives without an explicit governed limitation.
