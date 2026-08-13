## ADDED Requirements

### Requirement: Teaching semantics publish as immutable domain fragments
The system SHALL publish Teaching Projection content as immutable, versioned domain fragments containing reviewed core-node memberships and direct ACT_TEACHING relations. A composed manifest SHALL order accepted fragments and bind their digests, Authority identity and deterministic projection identity.

#### Scenario: New domain fragment is accepted
- **WHEN** a fragment passes identity, endpoint, evidence and graph validation
- **THEN** a new composed Teaching Projection version SHALL include that fragment without modifying prior fragment bytes or evidence

#### Scenario: Fragment identity drifts
- **WHEN** a fragment does not match its declared Authority selection, source revision or digest
- **THEN** the candidate projection SHALL fail closed and the prior published projection SHALL remain unchanged

### Requirement: Teaching coverage is independent from Authority readiness
The system SHALL represent domain teaching coverage as `available`, `partial`, `empty` or `unavailable` independently from Engineering Authority readiness. Low edge counts, uncovered Authority objects and an empty valid domain SHALL NOT block Authority activation, domain navigation or engineering relation browsing.

#### Scenario: Domain has partial teaching coverage
- **WHEN** some reviewed direct teaching relations are published and other objects remain uncovered
- **THEN** the published relations SHALL load and the domain SHALL report partial coverage
- **AND** Engineering Authority SHALL remain usable

#### Scenario: Teaching service is unavailable
- **WHEN** the optional teaching layer cannot be resolved
- **THEN** engineering objects and eligible engineering relations SHALL remain available
- **AND** the product SHALL distinguish service unavailability from no published teaching relation

### Requirement: Future reviewed relations load without frontend code changes
A future direct teaching relation SHALL enter its matching domain shards after a valid new Teaching Projection is activated, provided its registered presentation contract is supported. The system SHALL NOT require a hard-coded per-release relation allowlist in the frontend.

#### Scenario: New reviewed prerequisite is published
- **WHEN** a later projection version adds a valid registered direct prerequisite
- **THEN** the next version-matched domain request SHALL include it automatically
- **AND** unchanged engineering facts and prior teaching evidence SHALL not require re-review
