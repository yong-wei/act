## ADDED Requirements

### Requirement: Core teaching resources are path-ready after manual semantic review
The ResourceNode registry SHALL support path-planning readiness for existing core teaching resources after human-reviewed semantic completion.

#### Scenario: Core teaching resource is completed
- **WHEN** an existing TeachingResource, runtime lesson planning unit, knowledge card, infograph, simulation, control workbench entry, Arena preview or terminal-validation resource, quiz, exercise, or platform-managed practice resource is marked path-plannable
- **THEN** it SHALL include reviewed knowledge mapping, LearningGoal fit, capability or quality contribution where applicable, route target, path stage, prerequisite relation, evidence contract, privacy policy, review metadata, and source/version reference
- **AND** the registry audit SHALL keep the resource blocked if any required field remains missing or provisional.

#### Scenario: Core resource is teacher-policy blocked or unavailable
- **WHEN** a core resource cannot be used by student path planning because of teacher policy, broken target, unavailable route, obsolete content, or restricted visibility
- **THEN** it SHALL be classified with a reviewed disposition and rationale
- **AND** the helper SHALL not count it as an unexplained missing path resource.

### Requirement: Core resources preserve evidence authority boundaries
The ResourceNode registry SHALL preserve official evidence authority when core resources include assessment, simulation, or Arena behavior.

#### Scenario: Arena, simulation, or control workbench resource is path-plannable
- **WHEN** an Arena, simulation, or control workbench resource is marked path-plannable or terminal-validation-capable
- **THEN** its ResourceNode metadata SHALL reference the allowed evidence behavior and limitation state
- **AND** it SHALL NOT fabricate or override official Arena score, validity, ranking, or leaderboard authority.
