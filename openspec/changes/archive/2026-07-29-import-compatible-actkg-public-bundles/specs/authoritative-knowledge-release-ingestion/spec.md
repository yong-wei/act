## ADDED Requirements

### Requirement: Standard candidate import consumes only a validated Bundle
The system MUST import a standard ActKG public Bundle only from one deterministic `ValidatedActKGBundle` emitted by the registered compatibility layer and MUST NOT rediscover files, infer Artifact roles, or reinterpret an unvalidated Manifest during persistence.

#### Scenario: Validated standard Bundle is submitted
- **WHEN** a compatible stable aggregate Bundle passes all compatibility and integrity gates
- **THEN** the candidate importer SHALL consume its validated identities, Artifacts, runtime Projection, components, Crosswalk, Metadata, statistics, and compatibility evidence

#### Scenario: Raw standard directory bypasses validation
- **WHEN** a caller submits a standard Bundle directory or raw Manifest directly to the persistence stage
- **THEN** the importer SHALL reject it without writing candidate data

### Requirement: Bundle and semantic Release persistence are distinct
The system MUST persist Bundle identity and revision, Manifest identity, Artifact metadata and raw bytes separately from the semantic Release, while preserving ReleaseSet, Release, Projection and component references without substituting one identity for another.

#### Scenario: Content Release is imported
- **WHEN** a validated Bundle carries a new Release identity or semantic digest
- **THEN** the system SHALL persist one Bundle Receipt and the exact Release, component, Projection, object, relation, Metadata and Crosswalk records bound to that ReleaseSet

#### Scenario: Packaging revision is imported
- **WHEN** a validated Bundle has a new Bundle revision but the same Release ID/hash, source dataset hash and semantic Artifact digests
- **THEN** the system SHALL persist the new Bundle Receipt and raw Artifact versions without duplicating semantic object, relation or Crosswalk rows

### Requirement: Standard candidate import is atomic and round-trip verified
The system MUST stage all standard Bundle records in one transaction, reconstruct every public Artifact and runtime semantic collection from persisted data, and write an immutable `ACCEPTED_CANDIDATE` receipt only after byte, identity, digest and count equality is proven.

#### Scenario: Standard import completes
- **WHEN** Stage and Round Trip both match the validated Bundle
- **THEN** one accepted non-production candidate ReleaseSet and its complete receipt SHALL become available for explicit Repository and governance reads

#### Scenario: Stage or Round Trip fails
- **WHEN** any write conflict, missing record, byte difference, identity difference, digest difference or count difference is detected
- **THEN** the transaction SHALL roll back and no partial Bundle, Artifact, Release, Projection, object, relation, Crosswalk or receipt SHALL become visible

#### Scenario: Identical Bundle is imported repeatedly
- **WHEN** the same Bundle digest is imported concurrently or repeatedly
- **THEN** the system SHALL return one semantically identical receipt and SHALL NOT duplicate any persisted row

### Requirement: Standard import preserves completed exact-adapter history
The standard importer MUST preserve the CTKG 0.2 data, exact adapter, raw Artifacts and receipts completed by #1125 and MUST represent fields absent from that historical contract as unavailable rather than fabricate or rewrite them.

#### Scenario: Existing v0.2 candidate is read after migration
- **WHEN** the standard import schema migration has completed
- **THEN** the #1125 candidate SHALL retain its original identities, bytes, counts, receipt and exact-contract behavior

#### Scenario: Historical row lacks a standard Bundle field
- **WHEN** a #1125 row has no Bundle Manifest identity or Artifact role introduced by the standard contract
- **THEN** the system SHALL expose that field as unavailable and SHALL NOT infer it from filenames or later Bundles

### Requirement: Import does not choose production or default candidate authority
Importing a compatible Bundle MUST create only an explicit non-production candidate and MUST NOT move the default candidate, active or Legacy selector or start a downstream consumer migration.

#### Scenario: New standard candidate is accepted
- **WHEN** its import receipt and Round Trip gates pass
- **THEN** authorized downstream processes MAY address it by exact ReleaseSet identity while all default and production selectors remain unchanged
