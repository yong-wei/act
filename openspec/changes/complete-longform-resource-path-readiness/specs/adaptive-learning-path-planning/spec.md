## ADDED Requirements

### Requirement: Planner can select reviewed long-form sections
The adaptive path planner SHALL consider reviewed textbook and reference sections as path resources when they satisfy LearningGoal policy and ResourceNode audit.

#### Scenario: Long-form section matches a LearningGoal
- **WHEN** a reviewed textbook or reference section covers a requested LearningGoal and passes path readiness
- **THEN** the planner MAY select it as a learning resource, remediation resource, enrichment resource, or prerequisite repair resource according to its reviewed path role
- **AND** it SHALL use lower-level chunks only as citation and rationale support unless they are separately reviewed as PathNodes.
