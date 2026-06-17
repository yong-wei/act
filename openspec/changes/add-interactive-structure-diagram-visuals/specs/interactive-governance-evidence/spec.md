## ADDED Requirements

### Requirement: Structure diagram evidence supports teacher diagnostics
Block diagram and signal-flow graph interactions SHALL produce backend evidence for structural misconceptions.

#### Scenario: Student submits a structure diagram interaction
- **WHEN** a student submits a graph selection or construction
- **THEN** evidence SHALL include module id, graph id, selected nodes, selected paths, selected loops, constructed positions, connection differences, reveal state, and timestamp
- **AND** the evidence SHALL be queryable by teacher diagnostics.

#### Scenario: Teacher reviews graph diagnostics
- **WHEN** the teacher opens diagnostics for a structure diagram module
- **THEN** the system SHALL show node/path/loop selection distribution, common missing links, common extra links, and reveal coverage
- **AND** it SHALL present teaching labels rather than raw manifest ids.
