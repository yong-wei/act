## MODIFIED Requirements

### Requirement: Validated Bundle output is storage independent
The compatibility layer MUST expose a deterministic, immutable Authority Snapshot representation in addition to validated storage-independent artifacts. The snapshot MUST retain Bundle, Release, ReleaseSet, Projection, schema, and source identities and MUST be byte-stable for identical validated input.

#### Scenario: Identical Bundle is materialized twice
- **WHEN** the same validated Bundle and ReleaseSet are materialized twice
- **THEN** both Authority Snapshots SHALL have the same normalized bytes and `snapshotHash`

#### Scenario: Snapshot loses typed engineering data
- **WHEN** snapshot normalization omits a valid object type, exact predicate, endpoint, or provenance identity
- **THEN** materialization SHALL fail closed rather than emitting a lossy Authority Snapshot

### Requirement: Public Bundle integrity is closed over the exact file set
The exact-file-set integrity gate MUST run before Authority Snapshot staging and pointer replacement; no teaching coverage or projection result may satisfy or bypass it.

#### Scenario: Hash or required file drifts
- **WHEN** a Bundle file, manifest, schema, or checksum differs from the locked identity
- **THEN** no Authority Snapshot or current pointer SHALL be emitted
