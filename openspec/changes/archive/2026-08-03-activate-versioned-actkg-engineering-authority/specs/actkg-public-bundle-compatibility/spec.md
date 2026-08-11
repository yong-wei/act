## MODIFIED Requirements

### Requirement: Validated Bundle output is storage independent
On a supported assessment, the compatibility layer SHALL emit one deterministic `ValidatedActKGBundle` containing all four identities, selected runtime Projection, preserved Projections, Link Metadata, Crosswalk, components, raw Artifacts, recomputed statistics, and compatibility evidence without writing a database or changing a runtime selector. The compatibility layer MUST also expose a deterministic, immutable Authority Snapshot representation that retains Bundle, Release, ReleaseSet, Projection, schema, and source identities and is byte-stable for identical validated input.

#### Scenario: Validation succeeds
- **WHEN** every required compatibility and integrity gate passes
- **THEN** downstream candidate import SHALL receive the validated object and no database, Repository, API, graph, or production selector SHALL have changed during validation

#### Scenario: Identical Bundle is materialized twice
- **WHEN** the same validated Bundle and ReleaseSet are materialized twice
- **THEN** both Authority Snapshots SHALL have the same normalized bytes and `snapshotHash`

#### Scenario: Snapshot loses typed engineering data
- **WHEN** snapshot normalization omits a valid object type, exact predicate, endpoint, or provenance identity
- **THEN** materialization SHALL fail closed rather than emitting a lossy Authority Snapshot

### Requirement: Public Bundle integrity is closed over the exact file set
The compatibility layer MUST validate the raw Manifest hash, Bundle digest, `SHA256SUMS`, every declared Artifact hash, byte length and JSONL record count, and MUST require the declared Artifact set plus reserved Manifest/checksum files to equal the regular files on disk. The exact-file-set integrity gate MUST run before Authority Snapshot staging and pointer replacement; no teaching coverage or projection result may satisfy or bypass it.

#### Scenario: Extra file is present
- **WHEN** a regular file exists in the Bundle but is not declared by the Manifest and is not a reserved Manifest/checksum file
- **THEN** the Bundle SHALL be rejected

#### Scenario: Dynamic counts match
- **WHEN** actual Release, Projection, Crosswalk, component, and vocabulary counts equal the values declared by the current Manifest
- **THEN** validation SHALL pass regardless of the counts used by an earlier Release fixture

#### Scenario: Hash or required file drifts
- **WHEN** a Bundle file, manifest, schema, or checksum differs from the locked identity
- **THEN** no Authority Snapshot or current pointer SHALL be emitted
