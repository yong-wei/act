## MODIFIED Requirements

### Requirement: Aggregate candidate identity is end-to-end consistent
Every candidate Repository query, response, cache key, and diagnostic MUST bind the explicitly selected ReleaseSet, Release and runtime Projection digest. A completed #1125 candidate SHALL use its frozen exact CTKG 0.2 diagnosis, while a standard candidate SHALL use its persisted Bundle, Schema, Artifact-contract and accepted-import receipt identities. Rows or diagnostics from different candidates MUST NOT be combined.

#### Scenario: Explicit standard candidate is queried
- **WHEN** an authorized consumer selects an accepted standard candidate by exact ReleaseSet and Release identity
- **THEN** all returned objects, relations, provenance and diagnostics SHALL belong to that ReleaseSet and runtime Projection digest

#### Scenario: Completed v0.2 candidate is queried
- **WHEN** a consumer selects the #1125 aggregate candidate
- **THEN** the Repository SHALL retain its frozen exact-contract validation and SHALL NOT require a later Manifest-only identity

#### Scenario: Historical result is requested
- **WHEN** an auditor explicitly requests a prior ReleaseSet
- **THEN** the Repository SHALL return it as historical and SHALL NOT label it current or reuse it in another candidate's readiness

#### Scenario: Candidate receipt is missing or mismatched
- **WHEN** a standard ReleaseSet lacks its accepted receipt or any persisted Bundle, Release, Schema or Projection identity disagrees
- **THEN** the Repository SHALL fail closed without reading Release files or falling back to Legacy

## ADDED Requirements

### Requirement: Explicit standard candidates preserve existing runtime contracts
The Repository MUST map a verified standard candidate to the existing `act.canvas.v2`, `act.node-detail.v2`, and `act.migration-review.v1` contracts without changing their public API shape, and MUST preserve valid unregistered types and predicates for generic read-only consumers.

#### Scenario: Compatible later Release is queried
- **WHEN** a standard candidate uses registered contracts but contains different valid counts, types, predicates or components
- **THEN** the Repository SHALL return its actual persisted values through the existing projection contracts without applying #1125 fixture totals

#### Scenario: Consumer lacks specialized semantics
- **WHEN** a valid standard candidate type or predicate has no specialized business adapter
- **THEN** the Repository SHALL keep it available for generic read-only projection and exclude it from unsupported business computation
