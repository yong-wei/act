## ADDED Requirements

### Requirement: Learner state consumes registered goal slices
The Learner State Service SHALL resolve goal-specific read models through the adaptive goal-slice registry.

#### Scenario: Registered goal slice is read
- **WHEN** learner state is requested for a registered goal
- **THEN** the service SHALL return only dimensions and metadata declared by that goal contract
- **AND** it SHALL include confidence, source coverage, freshness, and privacy metadata for each visible field family.
- **AND** it SHALL preserve declared non-dimensional field families such as active path context, recent path rounds, terminal validation state, and no-active-path state when those families are part of the goal contract.

#### Scenario: Registered control-correction path context is read
- **WHEN** learner state is requested for `goal=control-correction`
- **THEN** the registered goal contract SHALL allow the active path id, status, current node, terminal validation state, and no-active-path state required by control-correction path consumers
- **AND** registry filtering SHALL NOT remove those fields merely because they are not competency dimensions.

#### Scenario: General learner state is read
- **WHEN** no goal is requested
- **THEN** existing general learner-state payloads SHALL remain compatible
- **AND** registered goal slices SHALL NOT be required for unrelated adaptive surfaces.
