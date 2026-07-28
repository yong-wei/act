## MODIFIED Requirements

### Requirement: First projection set is bounded and versioned
The Repository SHALL provide `act.canvas.v2`, `act.node-detail.v2`, and `act.migration-review.v1`, each declaring its projection version, aggregate source ReleaseSet, source release hash, source dataset hash, projection digest, included fields, and hidden fields.

#### Scenario: Canvas projection is built
- **WHEN** `act.canvas.v2` is requested for `control-theory-engineering-v0.2`
- **THEN** it SHALL preserve all public typed object identities, exact relation predicates, direction, relation family, release tier, and evidence state needed by the canvas

#### Scenario: Detail projection is built
- **WHEN** `act.node-detail.v2` is requested for an authorized role
- **THEN** it SHALL return only the detail fields allowed for that role and SHALL preserve the aggregate ReleaseSet provenance

#### Scenario: Migration review is built
- **WHEN** an administrator requests `act.migration-review.v1`
- **THEN** it SHALL report aggregate ingest, component validation, stale shadow outputs, Legacy archive readiness, and active-consumer rebinding status without changing authoritative data

## ADDED Requirements

### Requirement: Aggregate candidate identity is end-to-end consistent
Every candidate Repository query, response, cache key, and diagnostic MUST bind the aggregate ReleaseSet identity and projection digest and MUST NOT combine rows from the prior root-locus ReleaseSet.

#### Scenario: Aggregate candidate is queried
- **WHEN** a consumer selects the current candidate
- **THEN** all returned objects, relations, and provenance SHALL belong to the one aggregate ReleaseSet and projection digest

#### Scenario: Historical result is requested
- **WHEN** an auditor explicitly requests a prior ReleaseSet
- **THEN** the Repository SHALL return it as historical and SHALL NOT label it current or reuse it in current readiness

### Requirement: Public projection is not promoted to private dataset authority
The Repository MUST distinguish imported public release/projection records from unavailable private CTKGDataset records.

#### Scenario: Consumer requests private-only content
- **WHEN** a consumer asks for content not present in the public aggregate bundle
- **THEN** the Repository SHALL return an explicit unavailable result and SHALL NOT synthesize it from display descriptions or crosswalk identifiers
