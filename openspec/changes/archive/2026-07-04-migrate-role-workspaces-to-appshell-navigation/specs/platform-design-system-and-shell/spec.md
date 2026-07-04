## ADDED Requirements

### Requirement: Role workspaces use the unified AppShell navigation frame
Teacher and administrator primary workspaces SHALL use AppShell or registered AppShell-compatible wrappers for first-level shell navigation.

#### Scenario: Teacher workspace renders
- **WHEN** a teacher primary route renders
- **THEN** it SHALL expose the same first-level AppShell navigation frame, top-right account access, and theme switching conventions as other primary platform routes
- **AND** teacher operation tabs SHALL render as secondary workflow navigation rather than competing first-level navigation.

#### Scenario: Administrator workspace renders
- **WHEN** an administrator primary route renders
- **THEN** it SHALL expose the same first-level AppShell navigation frame, account access, and theme switching conventions
- **AND** admin domain controls SHALL remain local or secondary to the admin workflow.

#### Scenario: Role workspace cannot migrate immediately
- **WHEN** a teacher or administrator route must keep a legacy layout during migration
- **THEN** the route ledger or governance allowlist SHALL declare the affected route, owner, reason, violated shell rule, and removal condition
- **AND** the exception SHALL NOT apply to newly introduced role workspace routes.

### Requirement: Role workspaces expose role-aware Personal Center actions
The platform shell SHALL expose a consistent top-right 个人中心/account action for student, teacher, and administrator roles without routing teachers or administrators into the student learner-record profile.

#### Scenario: Student role action renders
- **WHEN** a student route renders the top-right shell action area
- **THEN** 个人中心 SHALL target `/profile`.

#### Scenario: Teacher role action renders
- **WHEN** a teacher route renders the top-right shell action area
- **THEN** 个人中心 SHALL target a teacher account or operations-center destination registered for the teacher role
- **AND** it SHALL NOT route to the student learner-record profile unless that route has an explicit teacher-safe mode.

#### Scenario: Administrator role action renders
- **WHEN** an administrator route renders the top-right shell action area
- **THEN** 个人中心 SHALL target an administrator account or operations-center destination registered for the administrator role
- **AND** it SHALL NOT route to the student learner-record profile unless that route has an explicit administrator-safe mode.
