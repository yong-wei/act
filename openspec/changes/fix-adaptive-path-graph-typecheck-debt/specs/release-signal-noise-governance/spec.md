## ADDED Requirements

### Requirement: Adaptive path and graph fixtures track current planner contracts
Adaptive path and graph typecheck repair SHALL update fixtures to current planner, graph coverage, and LearningGoal contracts without changing planner policy.

#### Scenario: Adaptive path graph cluster is repaired
- **WHEN** the adaptive path/graph cleanup runs
- **THEN** TypeScript errors in adaptive path planner, control-correction path rounds, learner-state, and assessment coverage tests SHALL be eliminated
- **AND** graph coverage, capability target, LearningGoal, and path graph context fixtures SHALL include required current fields.

#### Scenario: Planner behavior is out of scope
- **WHEN** this change repairs TypeScript fixtures
- **THEN** it SHALL NOT change path ranking, resource selection, or low-resource fallback policy unless a typed production contract is demonstrably wrong.
