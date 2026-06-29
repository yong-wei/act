## ADDED Requirements

### Requirement: Planner explains SAR candidate adoption and rejection
The adaptive path planner SHALL expose how SAR-associated candidates affected path planning.

#### Scenario: SAR candidates are evaluated
- **WHEN** path planning receives SAR candidate refs and trace metadata
- **THEN** the resulting path explanation SHALL include seed entities, candidate resource ids, selected candidate ids, rejected candidate ids, and rejection reasons
- **AND** the path SHALL remain valid when SAR is disabled or unavailable.
