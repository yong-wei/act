## MODIFIED Requirements

### Requirement: Standalone routes remain available
The system SHALL preserve existing standalone `/simulations/*` routes while adding course-resource launch support.

#### Scenario: Student opens standalone simulation route
- **WHEN** a student opens a standalone simulation route
- **THEN** the route SHALL remain available and record standalone launch context rather than course/class/session context

#### Scenario: Student opens the simulation catalog
- **WHEN** a student opens `/simulations`
- **THEN** the page SHALL be the canonical standalone simulation catalog.
- **AND** it SHALL NOT expose model deployment status, task-chain status, preparing/open model counts, or model file paths as student-facing availability truth.
- **AND** existing `/simulations/*` scene deep links SHALL remain reachable.
