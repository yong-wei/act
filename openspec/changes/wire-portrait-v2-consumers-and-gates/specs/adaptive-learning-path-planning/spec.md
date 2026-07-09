## MODIFIED Requirements

### Requirement: Planner gates active path nodes by learner readiness
The adaptive path planner SHALL evaluate learner readiness using portrait v2
learner-state signals before placing a ResourceNode into the immediately
executable portion of a generated path.

#### Scenario: Student lacks readiness for a heavy node
- **WHEN** a student requests a path and the portrait v2 learner-state slice is below a node's readiness threshold
- **THEN** the planner SHALL exclude that node from `activeNodeIds`
- **AND** it SHALL include preparation nodes or fallback nodes before the locked node when such nodes are available
- **AND** it SHALL keep the locked node out of current or next executable actions.

#### Scenario: Low-readiness control-correction learner requests a path
- **WHEN** student `20230010102601` or an equivalent learner has low portrait v2 readiness for control modeling/representation and controller design/synthesis
- **THEN** Arena and other terminal heavy nodes SHALL NOT be returned as immediate current nodes
- **AND** the first executable option SHALL start with preparation, knowledge, guided practice, diagnosis, or low-risk resource nodes
- **AND** any values derived from legacy six-dimensional compatibility mapping SHALL be identified in diagnostics.

## ADDED Requirements

### Requirement: Path personalization uses portrait v2
Adaptive path planning SHALL use portrait v2 dimensions for learner-state
personalization, weak-dimension targeting, and path rationale.

#### Scenario: Planner ranks resources by learner needs
- **WHEN** the planner personalizes resources for a learner
- **THEN** weak-dimension signals SHALL be read from portrait v2
- **AND** selected-resource rationales SHALL reference portrait v2 dimensions rather than legacy six-dimensional ids.

#### Scenario: Only legacy portrait data exists
- **WHEN** planner input contains only migrated compatibility data
- **THEN** the planner SHALL include limitation metadata in diagnostics
- **AND** it SHALL NOT silently present compatibility-derived values as native portrait v2 evidence.
