# kaq-objective-taxonomy Specification

## Purpose
Define canonical knowledge, capability, and quality objectives and the portrait v2 compatibility contract used by graph-center filters, learner overlays, and future adaptive path targets.
## Requirements
### Requirement: K/A/Q objectives are first-class teaching targets
The system SHALL define knowledge, capability, and quality objectives as canonical teaching targets with stable ids, explicit hierarchy, and LearningGoal package usability.

#### Scenario: Objective is used by a LearningGoal package
- **WHEN** a K/A/Q objective is referenced by a LearningGoal package
- **THEN** the objective SHALL expose stable id, domain, title, hierarchy level, and graph binding data sufficient for goal package validation
- **AND** missing graph binding SHALL be represented as a package limitation rather than silently accepted.

### Requirement: Portrait v2 preserves six-dimensional compatibility
The system SHALL introduce a seven-dimension portrait v2 without breaking the existing six-dimensional learner-state contract.

#### Scenario: Existing learner state is read
- **WHEN** a consumer reads current six-dimensional learner state
- **THEN** the existing dimensions SHALL remain available unchanged
- **AND** portrait v2 aggregation MAY be derived through explicit compatibility mapping with confidence and limitation metadata.

#### Scenario: Objective maps to portrait v2
- **WHEN** a secondary or tertiary K/A/Q objective is defined
- **THEN** it SHALL map to at least one portrait v2 dimension
- **AND** the mapping SHALL be usable by graph-center filters, learner overlays, and future path-planning target registration.

