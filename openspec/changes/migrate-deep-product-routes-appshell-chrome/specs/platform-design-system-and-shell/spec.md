## ADDED Requirements

### Requirement: Deep product routes preserve the universal shell
Second-level and deeper product routes SHALL keep the universal AppShell frame unless they are listed in the governed exception inventory.

#### Scenario: Course or lesson route renders
- **WHEN** a course entry, student lesson runtime, teacher lesson runtime, or waiting route renders
- **THEN** it SHALL keep the canonical left navigation rail and shared top bar
- **AND** lesson controls SHALL render as local tools or workspace slots rather than replacing the shell frame.

#### Scenario: Classroom route renders
- **WHEN** a classroom join, student session, teacher session, or classroom review route renders
- **THEN** it SHALL expose the shared top bar, breadcrumbs, and canonical first-level navigation
- **AND** teaching controls SHALL remain local to the classroom workflow.

#### Scenario: AI, playlist, teacher, administrator, or legacy route renders
- **WHEN** an AI assistant, playlist, dashboard, missions, teacher, administrator, data-center, graph-center, or legacy learning route renders
- **THEN** it SHALL use the universal shell or an AppShell-compatible wrapper
- **AND** its active navigation state SHALL resolve to the correct first-level product area.

#### Scenario: Role route renders
- **WHEN** a teacher or administrator route renders
- **THEN** it SHALL keep the same shell top bar and canonical left navigation behavior
- **AND** its Personal Center action SHALL target the role-safe account or operations destination rather than the student learner profile unless an explicit teacher-safe or administrator-safe profile mode exists.

#### Scenario: Immersive workflow needs more space
- **WHEN** a deep route needs an immersive layout for teaching, simulation, or review
- **THEN** it MAY use AppShell workspace slots, hidden local panels, or responsive density controls
- **AND** it SHALL NOT remove first-level orientation unless the route is in the governed exception inventory.

#### Scenario: Deep route wrapper is evaluated
- **WHEN** a deep route is covered by `InteractiveLearningShell`, `CourseEntryShell`, `LessonRuntimeShell`, `ArenaPageShell`, a simulation shell, classroom shell, teacher shell, or administrator shell
- **THEN** that wrapper SHALL be registered and tested against the shared AppShell DOM contract
- **AND** route-local commands SHALL render in the wrapper's local command region rather than in the shell account/theme action pair.
