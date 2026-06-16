## ADDED Requirements

### Requirement: Planner gates active path nodes by learner readiness
The adaptive path planner SHALL evaluate learner readiness before placing a ResourceNode into the immediately executable portion of a generated path.

#### Scenario: Student lacks competency for a heavy node
- **WHEN** a student requests a path and the learner-state slice is below a node's readiness threshold
- **THEN** the planner SHALL exclude that node from `activeNodeIds`
- **AND** it SHALL include preparation nodes or fallback nodes before the locked node when such nodes are available
- **AND** it SHALL keep the locked node out of current or next executable actions.

#### Scenario: Zero-competency control-correction learner requests a path
- **WHEN** student `20230010102601` or an equivalent learner has zero control-modeling and parameter-design competency
- **THEN** Arena and other terminal heavy nodes SHALL NOT be returned as immediate current nodes
- **AND** the first executable option SHALL start with preparation, knowledge, guided practice, diagnosis, or low-risk resource nodes.

### Requirement: Path options carry active and locked readiness structure
Generated path options SHALL distinguish active nodes, locked nodes, readiness summaries, and unlock conditions.

#### Scenario: Option contains future heavy work
- **WHEN** a path option includes Arena, simulation, control workbench, or terminal validation as future work
- **THEN** the option SHALL include `activeNodeIds`, `lockedNodeIds`, `readinessSummary`, and student-facing unlock messages
- **AND** downstream selection and execution SHALL use those fields instead of recomputing readiness from visible labels.

#### Scenario: Dependent node readiness changes
- **WHEN** a completed preparation node or complex-node result satisfies a readiness condition
- **THEN** the planner SHALL be able to unlock the dependent node without discarding the original path history.
