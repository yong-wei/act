## ADDED Requirements

### Requirement: Coordinated consumers select only a complete matching Teaching Projection
A coordinated production activation manifest SHALL select only a Teaching Projection whose governance receipt is complete for all three relation families, reports zero unresolved candidates, and binds the exact captured Authority, course active-domain scope, formal resource envelope, coordination allocation record, and projection hash. It SHALL also select the exact composed domain-fragment manifest and immutable fragment set derived from that projection. The later coordinated candidate receipt SHALL bind the immutable Teaching Projection, governance-receipt, composed-manifest, and fragment-set hashes; none of those Teaching artifacts may refer back to that outer receipt hash. Engineering-only or non-coordinated consumers MAY retain combinations permitted by their existing contracts, but no teaching consumer in the coordinated product combination may select a `PARTIAL`, empty, stale, or mismatched projection or fragment set.

#### Scenario: Complete matching projection is selected
- **WHEN** the Teaching Projection is three-family complete and its Authority, scope, resource envelope, allocation record, projection hash, composed domain-fragment manifest, and immutable fragment-set hash all match the successor combination whose outer candidate receipt binds them
- **THEN** the teaching consumers MAY select that exact projection within the stopped-service coordinated transaction

#### Scenario: Partial projection is offered
- **WHEN** a projection has complete containment but pending prerequisite or pedagogical-association work
- **THEN** the coordinated activation manifest SHALL reject it
- **AND** it MAY remain available only through an independently permitted non-coordinated state

#### Scenario: Complete projection has a different identity
- **WHEN** a complete Teaching Projection or its composed domain-fragment manifest and fragment set references another Authority capture, course scope, formal resource envelope, coordination allocation record, or projection hash
- **THEN** the coordinated candidate and activation SHALL fail before consumer selection
