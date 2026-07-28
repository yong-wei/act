## ADDED Requirements

### Requirement: Full resource semantic completion can be closed
The data-quality gates SHALL provide a final closure check proving current project resources have complete reviewed semantic disposition and path/citation readiness.

#### Scenario: Full closure check runs
- **WHEN** resource-family completion batches have landed
- **THEN** the closure check SHALL consume helper output, ResourceNode audit output, LearningGoal stage coverage, path diagnostics, and resource-metadata citation addressability checks
- **AND** it SHALL fail on unexplained missing disposition, unreviewed semantic fields, invalid path promotion, missing parent PlanningUnit link, missing exclusion rationale, missing evidence policy, or missing citation addressability.

#### Scenario: Current resources are accounted for
- **WHEN** the closure check enumerates current discovered resources
- **THEN** every resource SHALL be classified as path-plannable, supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale
- **AND** each classification SHALL include review metadata and source/version evidence or a concrete external blocker.

#### Scenario: Closure succeeds
- **WHEN** full resource semantic completion succeeds
- **THEN** the new-resource gate SHALL be tightened so future resource additions and modified existing records cannot bypass reviewed semantic completeness
- **AND** any future incomplete resource SHALL fail local gate or CI-ready checks.
