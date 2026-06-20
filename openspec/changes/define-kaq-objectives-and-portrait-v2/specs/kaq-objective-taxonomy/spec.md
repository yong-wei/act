## ADDED Requirements

### Requirement: K/A/Q objectives are first-class teaching targets
The system SHALL define knowledge, capability, and quality objectives as canonical teaching targets with stable ids and explicit hierarchy.

#### Scenario: Objective catalog is validated
- **WHEN** the K/A/Q objective catalog is loaded
- **THEN** every objective SHALL declare id, domain, level, parent id or null, title, description, portrait dimensions, evidence policy, graph binding policy, and status
- **AND** validation SHALL reject duplicate ids, invalid parent ids, domain mismatches, missing portrait dimensions, missing evidence policy, or missing graph binding.

### Requirement: Portrait v2 preserves six-dimensional compatibility
The system SHALL introduce a seven-dimension portrait v2 without breaking the existing six-dimensional learner-state contract.

#### Scenario: Existing learner state is read
- **WHEN** a consumer reads current six-dimensional learner state
- **THEN** the existing dimensions SHALL remain available unchanged
- **AND** portrait v2 aggregation MAY be derived through explicit compatibility mapping with confidence and limitation metadata.

#### Scenario: Objective maps to portrait v2
- **WHEN** a secondary or tertiary K/A/Q objective is defined
- **THEN** it SHALL map to at least one portrait v2 dimension
- **AND** the mapping SHALL be usable by graph-center filters, learner overlays, and future path-planning target registration.
