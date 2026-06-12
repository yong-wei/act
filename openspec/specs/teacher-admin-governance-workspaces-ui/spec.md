## Purpose

Define teacher and admin governance workspace UI contracts for ResourceNode management, evidence readiness, privacy redaction, and data-center status.
## Requirements
### Requirement: Teacher governance workspace consumes authorized ResourceNode management
The system SHALL provide teacher governance UI that presents authorized ResourceNode browse, search, review, warning inspection, and permitted single-node edit affordances from the `teacher-resource-node-management` capability.

#### Scenario: Teacher opens ResourceNode management
- **WHEN** a teacher opens the ResourceNode management workspace
- **THEN** the UI SHALL surface the `teacher-resource-node-management` browse/filter/review affordances for node type, course/module, knowledge mapping, availability, privacy level, teacher policy, evidence instrumentation, and path eligibility
- **AND** this change SHALL own the governance shell, status display, action placement, and redaction behavior rather than redefining ResourceNode edit rules or teacher homepage behavior.

### Requirement: Governance views protect restricted payloads
The system SHALL prevent teacher and admin governance UI from exposing restricted payloads outside their permitted role scope.

#### Scenario: Restricted evidence exists
- **WHEN** a ResourceNode, learner-state, path, Arena, simulation, or Konling record references restricted data
- **THEN** the UI SHALL show an allowed summary, restricted marker, or audit-only reference without exposing hidden official evaluation internals, raw high-frequency traces, raw answers, or private memory.

### Requirement: Admin data center distinguishes readiness from presentation metrics
The system SHALL provide admin/data-center UI that separates product presentation metrics from governance readiness and audit status.

#### Scenario: Admin reviews evidence source health
- **WHEN** an admin opens governance status
- **THEN** the UI SHALL show source coverage, readiness, unsupported states, missing context, privacy status, replay confidence, and evaluation-event health where available.

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

### Requirement: Teacher and admin homes prioritize operational decisions
Teacher and admin home surfaces SHALL prioritize current work, pending actions, risks, and unavailable states over directory cards.

#### Scenario: Teacher or admin home renders
- **WHEN** `/teacher` or `/admin` opens
- **THEN** the first viewport SHALL show active work, pending decisions, risks, or next actions relevant to the role
- **AND** route directory cards SHALL NOT be the only primary hierarchy.

### Requirement: Operations navigation persists across role subpages
Teacher and admin operations navigation SHALL remain continuous across subpages.

#### Scenario: Role subpage renders
- **WHEN** teacher classes, lesson plans, resources, history, analytics, admin users, states, config, or governance pages render
- **THEN** the route SHALL preserve the role operations navigation, current location, and account/cockpit semantics
- **AND** mobile layouts SHALL expose the same work domains without relying on desktop sidebars.

### Requirement: Teacher operations connect preparation, classroom, evidence, and reporting
Teacher operations surfaces SHALL support a complete teaching workflow rather than isolated console entries.

#### Scenario: Teacher follows a teaching workflow
- **WHEN** a teacher moves from class to lesson plan, resource or ResourceNode, classroom launch, student activity evidence, classroom history, analytics, or report entry
- **THEN** each surface SHALL preserve role navigation, current object context, next action, and evidence availability
- **AND** teacher controls, telemetry summaries, and teacher insight states SHALL remain visible where the underlying runtime provides them.

### Requirement: Teacher and admin operations use operations-console shell
Teacher and administrator operations routes SHALL converge on the operations-console archetype for role navigation, object context, pending work, status semantics, and shared dock behavior.

#### Scenario: Operations route renders
- **WHEN** teacher home, teacher analytics, teacher resources, admin home, admin users, admin config, admin states, or admin governance routes render after migration
- **THEN** the route SHALL preserve role operations navigation, current object or work context, next actions, risks, and account/cockpit semantics through the unified shell
- **AND** page-local shells SHALL not compete with the operations-console navigation language.

### Requirement: Operations surfaces expose unavailable future data honestly
Teacher and admin operations UI SHALL represent unavailable analytics, model, overlay, or governance data as explicit loading, disabled, feature-flagged, or unsupported states.

#### Scenario: Future data is not available
- **WHEN** class analytics, student analytics, model governance, runtime overlay state, or system health data is missing
- **THEN** the UI SHALL show an honest unavailable or pending state with permitted adjacent actions
- **AND** it SHALL NOT fabricate metrics or hide missing capability behind decorative placeholders.
