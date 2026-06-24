## ADDED Requirements

### Requirement: Teacher operations surfaces share one workspace model
The system SHALL render teacher dashboard, classes, lesson plans, resources, history, and future class/student learning analytics through one teacher operations workspace model.

#### Scenario: Teacher opens an operations route
- **WHEN** a teacher opens `/teacher`, `/teacher/classes`, `/teacher/lesson-plans`, `/teacher/resources`, `/teacher/history`, or a future class/student analytics route
- **THEN** the page SHALL preserve teacher operations navigation, role context, object-level actions, status semantics, and shared floating dock behavior
- **AND** it SHALL NOT introduce a page-local shell or unrelated card-only layout.

### Requirement: Admin management surfaces share one console model
The system SHALL render admin dashboard, users, model/settings, system settings, usage statistics, and governance through one admin console model.

#### Scenario: Admin opens a management route
- **WHEN** an admin opens `/admin`, `/admin/users`, `/admin/config`, `/admin/states`, `/admin/data-governance`, or a future model management route
- **THEN** the page SHALL preserve admin domain navigation, management actions, role context, risk/status semantics, and shared floating dock behavior
- **AND** user, model, system, and governance functions SHALL not appear as unrelated standalone products.

### Requirement: Operations routes expose future analytics slots honestly
Teacher and admin operations surfaces SHALL reserve space for future student, class, model, or system analytics only as explicit empty, loading, disabled, or feature-flagged states.

#### Scenario: Future analytics are unavailable
- **WHEN** class analytics, student analytics, model management, or system health data is not yet available
- **THEN** the UI SHALL show an honest unavailable or pending state with permitted adjacent actions
- **AND** it SHALL NOT fabricate metrics or hide missing capability behind decorative placeholders.
