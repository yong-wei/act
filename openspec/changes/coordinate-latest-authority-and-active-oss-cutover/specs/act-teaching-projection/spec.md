## ADDED Requirements

### Requirement: Coordinated consumers select only a complete matching Teaching Projection
A coordinated production activation manifest SHALL select only a Teaching Projection whose governance receipt is complete for all three relation families, reports zero unresolved candidates, and binds the exact captured Authority, course active-domain scope, formal resource envelope, coordination allocation record, and projection hash. The later coordinated candidate receipt SHALL bind the immutable Teaching Projection and governance-receipt hashes; neither Teaching artifact may refer back to that outer receipt hash. Engineering-only or non-coordinated consumers MAY retain combinations permitted by their existing contracts, but no teaching consumer in the coordinated product combination may select a `PARTIAL`, empty, stale, or mismatched projection.

#### Scenario: Complete matching projection is selected
- **WHEN** the Teaching Projection is three-family complete and its Authority, scope, resource envelope, allocation record, and projection hash all match the successor combination whose outer candidate receipt binds it
- **THEN** the teaching consumers MAY select that exact projection within the stopped-service coordinated transaction

#### Scenario: Partial projection is offered
- **WHEN** a projection has complete containment but pending prerequisite or pedagogical-association work
- **THEN** the coordinated activation manifest SHALL reject it
- **AND** it MAY remain available only through an independently permitted non-coordinated state

#### Scenario: Complete projection has a different identity
- **WHEN** a complete Teaching Projection references another Authority capture, course scope, formal resource envelope, or coordination allocation record
- **THEN** the coordinated candidate and activation SHALL fail before consumer selection
