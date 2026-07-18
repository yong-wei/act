## ADDED Requirements

### Requirement: Path planner consumes the unified ResourceNode registry
Adaptive path generation SHALL consume the same governed ResourceNode registry projection used by the resource center and data-completeness helper.

#### Scenario: Planner loads candidate resources
- **WHEN** a student requests a path for any registered LearningGoal
- **THEN** the path-generation entrypoint SHALL load audited ResourceNodes from registered resources, runtime lesson projections, runtime lessons, media and handout dispositions, textbook or reference PlanningUnits, and generated checkpoint contracts through one governed loader
- **AND** it SHALL report registry version, projection version, and candidate counts by resource family.

#### Scenario: Partial registry would hide resources
- **WHEN** a production entrypoint can only see registered resources or textbook catalog rows but runtime projections also exist
- **THEN** diagnostics SHALL report the missing source family
- **AND** the generated path SHALL be marked limited rather than presented as a complete resource-aware recommendation.

#### Scenario: Retrieval-only record ranks highly
- **WHEN** a retrieval chunk, search document, figure, caption, transcript segment, or citation target is relevant to the LearningGoal
- **THEN** the planner MAY use it as ranking or citation support
- **AND** it SHALL NOT promote that record to a PathNode unless an audited ResourceNode or checkpoint contract authorizes path eligibility.
