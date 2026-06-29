## ADDED Requirements

### Requirement: Path planning treats SAR as supplemental candidate evidence
Adaptive path planning SHALL consume SAR candidates only as supplemental candidate evidence and explanation basis.

#### Scenario: SAR returns relevant resource candidates
- **WHEN** SAR association expansion returns candidate resource, retrieval chunk, citation target, or planning unit refs for a LearningGoal
- **THEN** the planner MAY use those refs to locate audited ResourceNode/PlanningUnit candidates
- **AND** it SHALL keep SAR candidates behind graph-mandated, teacher-assigned, and ordinary ResourceNode-eligible candidates.

#### Scenario: SAR candidate is not path eligible
- **WHEN** a SAR candidate lacks an audited ResourceNode, PlanningUnit, privacy permission, teacher policy permission, readiness, or terminal validation capability required by the LearningGoal
- **THEN** the planner SHALL reject it as a PathNode candidate and record a reason
- **AND** it MAY keep it only as supporting evidence when allowed.
