# adaptive-goal-slice-registry Specification

## Purpose
Define the governed registry that adaptive learner-state consumers use to resolve goal-specific slices before personalization, path planning, reporting, grading writeback, or Konling runtime consumption.
## Requirements
### Requirement: Adaptive goals are registered before use
The system SHALL provide a registry for adaptive goal slices used by learner state, path planning, diagnosis, reports, grading writeback, and Konling modes.

#### Scenario: Registered goal is requested
- **WHEN** a consumer requests a registered adaptive goal
- **THEN** the registry SHALL expose goal id, display labels, dimensions, target levels, evidence source families, privacy classes, confidence policy, path eligibility, report eligibility, and validation fixtures.

#### Scenario: Unregistered goal is requested
- **WHEN** a consumer requests an adaptive goal that is not registered
- **THEN** the system SHALL return an explicit unsupported-goal or unavailable state
- **AND** it SHALL NOT silently reinterpret the request as general learner state.

### Requirement: Goal slices declare field contracts
Every adaptive goal slice SHALL declare machine-readable contracts for its dimension fields.

#### Scenario: Goal dimension is declared
- **WHEN** a goal dimension is added
- **THEN** it SHALL declare value range, target level mapping, source families, evidence threshold, freshness policy, confidence policy, privacy visibility, and fallback reason.

#### Scenario: Goal dimension is undeclared
- **WHEN** implementation emits a dimension that is absent from the registered goal contract
- **THEN** validation SHALL fail before the dimension is used for personalization, path planning, reporting, or grading writeback.
