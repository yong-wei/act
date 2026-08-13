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
The system SHALL represent domain teaching coverage as `available`, `partial`, `empty` or `unavailable` independently from Engineering Authority readiness. Low edge counts, uncovered Authority objects and an empty valid domain SHALL NOT fail the fragment/composition gate or require Authority reactivation.

#### Scenario: Domain has partial teaching coverage
- **WHEN** some reviewed direct teaching relations are published and other objects remain uncovered
- **THEN** the composed artifact SHALL retain those relations and record partial coverage
- **AND** the Authority binding SHALL remain valid for the independent activation contract

#### Scenario: Teaching service is unavailable
- **WHEN** the optional teaching layer cannot be resolved
- **THEN** the artifact contract SHALL distinguish unavailability from empty published coverage
- **AND** it SHALL not fabricate a teaching relation or alter the Authority binding

### Requirement: Future reviewed relations enter the composed projection without release-specific relation lists
A future direct teaching relation SHALL enter its matching composed Teaching Projection when its immutable fragment is accepted and its registered presentation contract is supported. The composition contract SHALL NOT require a hard-coded per-release relation allowlist.

#### Scenario: New reviewed prerequisite is published
- **WHEN** a later projection version adds a valid registered direct prerequisite
- **THEN** the next composed projection SHALL include the relation according to its declared domain membership
- **AND** unchanged engineering facts and prior teaching evidence SHALL not require re-review
