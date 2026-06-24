## ADDED Requirements

### Requirement: LearningGoal baseline resource coverage constrains graph-driven planning
The adaptive path planner SHALL use human-confirmed baseline resource coverage before treating an in-scope path-ready LearningGoal as production-generatable.

#### Scenario: Baseline-covered LearningGoal is requested
- **WHEN** a student requests a graph-driven path for an in-scope path-ready LearningGoal with baseline resource coverage
- **THEN** the planner SHALL select only human-confirmed, audited ResourceNodes or checkpoint contracts
- **AND** the path SHALL include concept support, diagnostic or evidence gathering, practice, checkpoint, and remediation or reflection where the LearningGoal policy requires them.

#### Scenario: LearningGoal baseline is incomplete
- **WHEN** a requested in-scope LearningGoal lacks required baseline resource categories
- **THEN** the planner SHALL return a low-resource limitation or blocked production writeback according to policy
- **AND** it SHALL NOT fabricate path diversity from unreviewed, provisional, retrieval-only, or citation-only resources.

#### Scenario: Heavy baseline node requires readiness
- **WHEN** a baseline path candidate includes simulation, Arena, control workbench validation, project, or terminal checkpoint resources
- **THEN** the planner SHALL respect readiness metadata before making the node current or immediately executable
- **AND** students below readiness SHALL receive fallback or preparation nodes first.

#### Scenario: Baseline coverage payload is exposed
- **WHEN** planner diagnostics or coverage surfaces report LearningGoal baseline state
- **THEN** the payload SHALL include denominator, source window, graph/goal/resource version refs, limitation reasons, and role-safe explanation fields
- **AND** student-facing payloads SHALL not expose internal resource governance diagnostics.
