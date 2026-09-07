## ADDED Requirements

### Requirement: Textbook channel consumes the structural-unit crosswalk at full volume
The teaching-projection textbook channel MUST consume the governed v2 structural-unit crosswalk rows for the three extraction-source books without being bounded to the legacy six locator rows. Rows whose canonical endpoints are unknown in the pinned Authority release MUST enter the exception ledger rather than be guessed onto a node.

#### Scenario: Governed crosswalk rows are projected
- **WHEN** the restage consumes the v2 structural-unit crosswalk
- **THEN** every admitted row SHALL produce textbook resources and EXPLAINS bindings for its canonical endpoints present in the pinned release
- **AND** the six legacy v1 locator rows SHALL remain consumable

#### Scenario: Row names an unknown canonical endpoint
- **WHEN** a crosswalk row lists a canonical id absent from the pinned Authority release
- **THEN** that endpoint SHALL enter the exception ledger
- **AND** it SHALL NOT create a binding

### Requirement: Crosswalk rows bind the active Authority release
Textbook crosswalk rows consumed by the restage MUST carry the active v0.37 Authority binding. Rows pinned to a superseded release MUST fail closed.

#### Scenario: Stale binding row is encountered
- **WHEN** a crosswalk row carries a v0.12 or otherwise stale authority binding
- **THEN** the textbook slice SHALL fail closed for that row
- **AND** the failure SHALL be reported with the row identity
