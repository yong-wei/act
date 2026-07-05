## ADDED Requirements
### Requirement: Runtime lesson steps are reviewed before PlanningUnit promotion
Runtime lesson steps SHALL become path-planning units only after step-level implementing-agent semantic review.

#### Scenario: Runtime step is promoted
- **WHEN** a runtime lesson step is promoted to a PlanningUnit
- **THEN** it SHALL have a verified route target, graph bindings, capability or quality contribution where applicable, estimated time, path role, prerequisite relation, evidence contract, privacy policy, source version, and review metadata
- **AND** provisional or generated metadata SHALL NOT satisfy promotion.

#### Scenario: Runtime step is not a PlanningUnit
- **WHEN** a runtime lesson step is display-only, transitional, embedded, duplicate, teacher-only, obsolete, or otherwise unsuitable for independent path planning
- **THEN** it SHALL be linked to a parent PlanningUnit, supporting citation, embedded asset record, evidence role, or reviewed exclusion rationale.
