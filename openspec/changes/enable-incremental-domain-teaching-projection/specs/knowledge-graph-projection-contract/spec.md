## ADDED Requirements

### Requirement: Layered graph responses preserve optional teaching coverage
Every Authority domain response SHALL identify whether its optional Teaching Projection layer is available, partial, empty or unavailable and SHALL preserve Engineering Authority objects and relations when that optional layer lacks coverage. Published teaching relations SHALL remain a separate ACT-owned layer and SHALL NOT be unioned into ActKG engineering relations.

#### Scenario: Authority is ready and teaching coverage is partial
- **WHEN** the requested Authority and catalog are valid but the matching Teaching Projection covers only part of the domain
- **THEN** the response SHALL contain the valid engineering layer and the published teaching subset
- **AND** it SHALL report partial teaching coverage without returning an Authority error

#### Scenario: Teaching relation version advances
- **WHEN** a new valid Teaching Projection version becomes active for the same Authority selection
- **THEN** teaching-layer caches SHALL invalidate independently and subsequent responses SHALL use the new published relations
- **AND** the Authority selection SHALL not need reactivation
