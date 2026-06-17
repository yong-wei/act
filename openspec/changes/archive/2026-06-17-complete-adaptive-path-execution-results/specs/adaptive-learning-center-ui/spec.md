## ADDED Requirements

### Requirement: Adaptive path center renders complex-node result cards
The adaptive learning center SHALL render result cards for adaptive assessment, simulation, control workbench, and Arena path nodes.

#### Scenario: Result card is shown
- **WHEN** a completed complex node has a bound result reference
- **THEN** the path center SHALL show node name, completion status, score or attainment, key metrics, evidence source, review state, and effect on later path recommendations
- **AND** the card SHALL use student-facing evidence language.

#### Scenario: Result is missing
- **WHEN** a complex node lacks the required result binding
- **THEN** the path center SHALL show `结果待同步`
- **AND** it SHALL offer recovery actions such as `刷新结果` or `返回当前节点`
- **AND** it SHALL NOT advance the visible current node past a dependency that requires the missing result.

### Requirement: Path history includes complex-node outcomes
The adaptive learning center SHALL include complex-node outcomes in path history and evidence review.

#### Scenario: Evidence review is opened
- **WHEN** a student opens the history or evidence review state
- **THEN** adaptive assessment, simulation, control workbench, Arena, Konling intervention, skip, return, and continued-interaction records SHALL appear in one chronological student-facing timeline.
