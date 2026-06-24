## MODIFIED Requirements

### Requirement: K/A/Q objectives are first-class teaching targets
The system SHALL define knowledge, capability, and quality objectives as canonical teaching targets with stable ids, explicit hierarchy, and LearningGoal package usability.

#### Scenario: Objective is used by a LearningGoal package
- **WHEN** a K/A/Q objective is referenced by a LearningGoal package
- **THEN** the objective SHALL expose stable id, domain, title, hierarchy level, and graph binding data sufficient for goal package validation
- **AND** missing graph binding SHALL be represented as a package limitation rather than silently accepted.
