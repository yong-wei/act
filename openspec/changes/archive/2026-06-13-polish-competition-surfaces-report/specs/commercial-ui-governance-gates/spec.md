## MODIFIED Requirements

### Requirement: Visual acceptance matrix is explicit
Commercial UI governance SHALL include a competition surface matrix for final submission readiness.

#### Scenario: Competition surface evidence is reviewed
- **WHEN** a PR changes final competition surfaces or assets
- **THEN** evidence SHALL include the affected teacher, student, administrator, grading, diagnosis, path, prep-pack, effect-report, simulation or Arena, and entry routes
- **AND** each required route SHALL include 1440px desktop and 320px mobile evidence in light and dark themes where supported
- **AND** missing evidence SHALL fail final competition readiness unless a narrow documented exception exists.

### Requirement: Navigation role boundaries are governed
Competition visual evidence SHALL preserve role-scoped navigation boundaries.

#### Scenario: Student competition evidence is checked
- **WHEN** student screenshots or DOM evidence are generated for the competition package
- **THEN** visible navigation SHALL NOT include Data Center
- **AND** review, evidence, diagnosis, and growth actions SHALL target learner-record routes.

### Requirement: Local tools do not become platform navigation
Competition surfaces SHALL preserve unified navigation while allowing local analytical tools.

#### Scenario: Report or workspace evidence is checked
- **WHEN** effect report, data provenance, knowledge, Arena, or control-workbench evidence is generated
- **THEN** filters, legends, source selectors, and local inspectors SHALL be marked as local tools
- **AND** they SHALL NOT introduce a competing shell or platform navigation pattern.
