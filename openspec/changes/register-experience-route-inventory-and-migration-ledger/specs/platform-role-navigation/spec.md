## ADDED Requirements

### Requirement: Primary route ledger assigns redesign ownership
The system SHALL maintain a primary route ledger that assigns each primary route to an experience archetype and owning migration change.

#### Scenario: Redesign series is planned
- **WHEN** a route belongs to homepage, auth, student entry, adaptive learning, Arena, simulation, Control Workbench, interactive runtime, learner record, knowledge, data center, teacher, admin, or report output
- **THEN** the route ledger SHALL record archetype, role scope, auth state, navigation layers, theme support, dock behavior, owning change, and visual QA profile
- **AND** no route SHALL have two owning changes without an explicit dependency or coupling rule.

#### Scenario: Special teaching and AI routes are inventoried
- **WHEN** classroom student player, course private student/player, teacher Arena, class analytics, student detail, AI, or AI copilot routes remain primary product routes
- **THEN** the route ledger SHALL assign them to an owning change and archetype or register a temporary exception
- **AND** the exception SHALL include owner, reason, affected capability, expiry, and removal condition.

### Requirement: Report-ledger inventory identifies real report surfaces
The system SHALL identify report-ledger routes or components before report visual migration is accepted.

#### Scenario: Report-ledger change is executed
- **WHEN** classroom, Arena, learner, governance, or data-center report and snapshot surfaces are redesigned
- **THEN** the route ledger SHALL identify whether each surface is a primary route, embedded component, export view, or temporary gap
- **AND** report-ledger ownership SHALL NOT take ownership of the source operational, knowledge, learner, or data-center shell unless explicitly declared.

### Requirement: Full ledger is distinct from representative screenshot matrix
The route ledger SHALL cover primary route ownership even when only representative routes are captured in a screenshot matrix.

#### Scenario: Visual QA matrix is smaller than route inventory
- **WHEN** a commercial UI PR only captures representative screenshots
- **THEN** the route ledger SHALL still identify every affected primary route and whether that route is directly captured, covered by a representative route, or temporarily excepted.
