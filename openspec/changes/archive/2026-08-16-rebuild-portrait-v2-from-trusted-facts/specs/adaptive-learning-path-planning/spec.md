## MODIFIED Requirements

### Requirement: Path personalization uses portrait v2
Adaptive path planning SHALL use trusted portrait v2 dimensions for
learner-state personalization, weak-dimension targeting, and path rationale.
When learner-state reports `NO_EVIDENCE` or no trusted current portrait, the
planner SHALL fail closed and SHALL NOT read legacy snapshot, feature cache,
old `StudentCompetencySnapshot`, or old competency vector values for
personalization. The planner MAY return a default or non-personalized starter
path.

#### Scenario: Planner ranks resources by learner needs
- **WHEN** the planner personalizes resources for a learner with a current trusted portrait
- **THEN** weak-dimension signals SHALL be read from trusted portrait v2
- **AND** selected-resource rationales SHALL reference portrait v2 dimensions rather than legacy six-dimensional ids.

#### Scenario: Only legacy portrait data exists
- **WHEN** planner input contains only migrated compatibility data and no trusted current portrait
- **THEN** the planner SHALL NOT use that data for personalized scoring or rationale
- **AND** it MAY return a default or starter path with limitation metadata
- **AND** it SHALL NOT silently present compatibility-derived values as native portrait v2 evidence.

#### Scenario: NO_EVIDENCE blocks legacy fallback
- **WHEN** learner-state is `NO_EVIDENCE` or lacks a trusted current portrait
- **THEN** the planner SHALL NOT use legacy snapshot, feature cache, `StudentCompetencySnapshot`, or competency vector for personalization
- **AND** it SHALL return a default or starter path when resources permit
- **AND** personalized claims SHALL NOT be generated from non-trusted data.

### Requirement: Cold-start learners receive executable starter paths
The planner SHALL treat cold start and trusted `NO_EVIDENCE` as supported
generation states, not as no-path failures.

#### Scenario: Cold-start learner requests a graph-driven path
- **WHEN** a learner with no usable trusted evidence or a current `NO_EVIDENCE` portrait requests a graph-driven LearningGoal path
- **THEN** the planner SHALL use the LearningGoal policy, resource coverage, ResourceNode readiness, and graph prerequisites to return executable starter options where resources are available
- **AND** low evidence SHALL be exposed as a limitation rather than clearing the path
- **AND** the planner SHALL NOT construct personalization claims from legacy portrait data.
