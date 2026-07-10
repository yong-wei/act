## ADDED Requirements

### Requirement: Teacher operation navigation exposes assignment management
The central role-navigation model SHALL expose `作业` as a teacher operation destination after `教案` and before `资源`, while preserving the global first-level platform navigation.

#### Scenario: Teacher opens the operations cockpit
- **WHEN** a teacher operations-console route renders its workflow navigation
- **THEN** `作业` SHALL link to `/teacher/assignments` after `教案` and before `资源`
- **AND** the current assignment route SHALL expose a consistent active state and accessible name.

#### Scenario: Teacher uses a dashboard quick action
- **WHEN** the teacher dashboard renders authorized preparation actions
- **THEN** it SHALL expose `新建作业` as a direct action to the assignment authoring route.

#### Scenario: Non-teacher navigation renders
- **WHEN** a student, administrator-only, or unauthenticated navigation scope renders
- **THEN** the teacher assignment operation entry SHALL NOT be exposed outside authorized teacher workflow navigation.
