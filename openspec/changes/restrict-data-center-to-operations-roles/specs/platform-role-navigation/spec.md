## MODIFIED Requirements

### Requirement: Role navigation is centrally defined
The system SHALL define role-specific navigation entries through a central schema rather than page-local header lists.

#### Scenario: Student navigation is rendered
- **WHEN** a student page renders primary navigation
- **THEN** it SHALL expose the configured student entries for simulations, knowledge/resource workspace, Arena, Control Workbench, adaptive learning, and Interactive Learning in stable relative order.
- **AND** Personal Center SHALL NOT be counted as one of the core student module entries.
- **AND** Data Center SHALL NOT be visible as a student core, review, or fallback navigation destination.

#### Scenario: Operations navigation is rendered
- **WHEN** a teacher or administrator page renders operations navigation
- **THEN** Data Center MAY be visible according to role policy and route inventory.
- **AND** the entry SHALL be treated as a teacher or administrator operations destination, not as a student learning destination.

### Requirement: Route inventory is the navigation source of truth
The system SHALL use route inventory to determine shell frame, role scope, navigation layers, mobile behavior, and dock behavior for primary routes.

#### Scenario: Primary route renders
- **WHEN** homepage, login, dashboard, Interactive Learning, Arena, Control Workbench, knowledge graph, data center, teacher, admin, or report route renders
- **THEN** the route SHALL resolve its navigation layers from central inventory
- **AND** page-local navigation lists SHALL NOT override central role and journey semantics.
- **AND** page-local fallback code SHALL NOT add Data Center to a role scope that the central inventory excludes.

### Requirement: Data center is operations-scoped
Data Center SHALL be an operations and governance route limited to teacher and administrator roles.

#### Scenario: Student opens data center directly
- **WHEN** an authenticated student opens `/data-center`
- **THEN** the student SHALL NOT see data-center navigation, metrics, source tables, or governance panels.
- **AND** the user SHALL be redirected to `/profile/evidence` by default.
- **AND** any contextual override SHALL target a non-data-center learner-record or dashboard destination.

#### Scenario: Teacher or administrator opens data center
- **WHEN** a teacher or administrator opens `/data-center`
- **THEN** the user SHALL see data-center navigation and content according to operations role policy.
