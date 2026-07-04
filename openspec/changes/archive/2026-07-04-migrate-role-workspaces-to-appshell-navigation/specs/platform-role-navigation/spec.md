## ADDED Requirements

### Requirement: Role operation navigation is secondary to global route navigation
Teacher and administrator operation navigation SHALL not replace or reorder the global first-level platform navigation.

#### Scenario: Teacher operation navigation is visible
- **WHEN** a teacher route shows classes, lesson plans, resources, prep packs, history, analytics, or report tools
- **THEN** those controls SHALL be presented as secondary workflow navigation
- **AND** the global first-level navigation SHALL remain available through the AppShell frame.

#### Scenario: Admin domain navigation is visible
- **WHEN** an admin route shows user, config, state, data-governance, or model-management domains
- **THEN** those controls SHALL be presented as admin workflow navigation
- **AND** they SHALL not be mixed into the student module order.
