# kaq-objective-taxonomy Specification

## Purpose
Define canonical knowledge, capability, and quality objectives and the portrait v2 compatibility contract used by graph-center filters, learner overlays, and future adaptive path targets.
## Requirements
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

### Requirement: Portrait v2 preserves six-dimensional compatibility
The system SHALL use the seven-dimension portrait v2 as the primary learner
portrait contract while preserving legacy six-dimensional learner-state only as
a compatibility and migration input.

#### Scenario: Existing learner state is read
- **WHEN** a consumer reads legacy six-dimensional learner state during migration
- **THEN** the existing dimensions SHALL remain available through explicit compatibility metadata
- **AND** portrait v2 aggregation SHALL be the primary learner portrait output when a portrait v2 record exists.

#### Scenario: Objective maps to portrait v2
- **WHEN** a secondary or tertiary K/A/Q objective is defined
- **THEN** it SHALL map to at least one portrait v2 dimension
- **AND** the mapping SHALL be usable by graph-center filters, learner overlays, adaptive path planning, Konling context, and learner profile presentation.

#### Scenario: New primary portrait is written
- **WHEN** learner portrait data is newly materialized after the portrait v2 migration starts
- **THEN** the write SHALL target the seven portrait v2 dimensions
- **AND** six-dimensional vectors SHALL NOT be written as the primary learner portrait truth.

