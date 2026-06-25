## ADDED Requirements

### Requirement: Adaptive path entrypoints follow the LearningGoal catalog
The adaptive learning center SHALL derive path generation entrypoints, goal selector options, labels, descriptions, route targets, and active-goal state from the registered `path-ready` LearningGoal catalog.

#### Scenario: Student opens generic path generation
- **WHEN** a student opens `/assessment/adaptive-practice` without a specific goal
- **THEN** the page SHALL render all registered `path-ready` LearningGoals as selectable generation targets
- **AND** the available target count SHALL match the backend LearningGoal catalog rather than a page-local hard-coded allow-list.

#### Scenario: Student changes the generation goal
- **WHEN** the student changes the learning goal in the generation panel
- **THEN** the active goal, URL query, stored generation parameters, latest-path lookup, path selection, path execution links, and return context SHALL use the selected LearningGoal id
- **AND** the page SHALL NOT coerce non-control-correction goals back to `control-correction`.

#### Scenario: Student views a non-control-correction path
- **WHEN** a generated or restored path belongs to any registered LearningGoal
- **THEN** the path map, current-node panel, completed-path summary, evidence review links, and generate-new-path actions SHALL display the owning LearningGoal metadata
- **AND** page state and helper behavior SHALL remain active-goal based rather than control-correction specific.

#### Scenario: Unknown goal is requested
- **WHEN** the route query names a goal id that is not present in the registered LearningGoal catalog
- **THEN** the page SHALL render a student-safe unavailable state or fall back to the generic path center
- **AND** it SHALL NOT generate a path, register a Konling context, or fetch latest paths for the unknown goal.

### Requirement: Dynamic LearningGoal entrypoints expose student-facing metadata
The adaptive learning center SHALL use LearningGoal metadata to explain every generation target before the student asks Konling or the planner to generate a path.

#### Scenario: Path-ready goal option renders
- **WHEN** a path-ready LearningGoal appears in the generation selector or entry surface
- **THEN** the option SHALL show student-facing title, description or completion meaning, learning intent, recommended phase, terminal-validation expectation, and any student-safe limitation where available
- **AND** the text SHALL come from the LearningGoal catalog projection rather than duplicated page literals.

#### Scenario: Current catalog is audited
- **WHEN** adaptive path center tests run against the current catalog
- **THEN** all nine current path-ready LearningGoals SHALL be visible through the generation entrypoint projection
- **AND** adding another path-ready LearningGoal without complete entrypoint metadata SHALL fail a catalog or UI contract test.
