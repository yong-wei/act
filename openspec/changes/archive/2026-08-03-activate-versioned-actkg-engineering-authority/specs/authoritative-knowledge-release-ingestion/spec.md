## MODIFIED Requirements

### Requirement: Import does not choose production or default candidate authority
Importing a compatible Bundle MUST create only an explicit staged/candidate Authority Snapshot and MUST NOT move the default candidate, Engineering Authority, active or Legacy selector, or start a downstream consumer migration. A separate explicit Authority activation transaction MAY atomically advance `authority/current.json` after the staged snapshot, manifest, and pointer target pass all integrity and deterministic checks; that transaction MUST not activate teaching consumers as a side effect.

#### Scenario: New standard candidate is accepted
- **WHEN** its import receipt, lossless round trip, snapshot manifest, and Delta/capture identities pass
- **THEN** authorized downstream processes MAY address it by exact ReleaseSet/snapshot identity while all default, Engineering Authority, teaching, and Legacy selectors remain unchanged

#### Scenario: Explicit Engineering Authority activation follows import
- **WHEN** a staged snapshot is selected by the dedicated activation operation and its target digest matches the immutable manifest
- **THEN** the operation SHALL atomically replace the Authority current pointer and MAY move Engineering Graph/RAG to that snapshot
- **AND** import and activation SHALL remain separately auditable transactions with no implicit CourseCoverage or teaching migration

#### Scenario: Activation target is incomplete or drifted
- **WHEN** the staged snapshot, target pointer, capture, or manifest digest is missing or mismatched
- **THEN** Authority activation SHALL fail closed
- **AND** the prior Authority/Legacy pointers SHALL remain unchanged

### Requirement: ReleaseSet import is atomic and conflict closed
The system MUST import the aggregate ReleaseSet in one transaction and fail the entire ingest on checksum failure, component inconsistency, missing projection endpoints, malformed or duplicate crosswalk triples, crosswalk published entities outside aggregate membership, inconsistent duplicate identities, undeclared revisions, or hash failures. Retrieval chunk and citation target identifiers that the public bundle declares only as opaque strings MUST NOT be required to resolve to package-internal entities or ACT structural units during this change. Standard ReleaseSet import MUST stage a complete immutable Authority Snapshot and MUST NOT replace the current Authority pointer. A separate explicit activation transaction MAY replace that pointer only after round-trip, identity, endpoint, count, and deterministic-hash checks pass. Import and activation MUST NOT consult CourseCoverage or activate teaching consumers.

#### Scenario: Referenced endpoint is absent
- **WHEN** any authoritative relation references an object outside the valid ReleaseSet
- **THEN** no object, relation, source mapping, or evidence row from that ingest SHALL become visible

#### Scenario: Any resolvable bundle reference is invalid
- **WHEN** a component, relation endpoint, release entry, or crosswalk published entity fails the pinned closure rules, or a crosswalk triple is malformed or duplicated
- **THEN** no artifact, object, relation, crosswalk, component, or receipt from that ingest SHALL become visible

#### Scenario: Opaque retrieval identifiers are imported
- **WHEN** valid crosswalk rows contain non-empty `retrieval_chunk_id` and `citation_target_id` values with no corresponding public package entities
- **THEN** the system SHALL preserve those values unchanged and SHALL defer ACT structural-unit resolution to aggregate course and resource governance

#### Scenario: Idempotent re-import occurs
- **WHEN** the same locked aggregate bundle is imported again
- **THEN** the system SHALL preserve one semantically identical candidate version and receipt without duplicate authoritative rows

#### Scenario: Valid stable Release is imported
- **WHEN** a locked Bundle passes compatibility and lossless round-trip checks
- **THEN** a complete staged Authority Snapshot SHALL be written
- **AND** the current pointer SHALL remain unchanged after import until a separate explicit activation succeeds

#### Scenario: Import validation fails
- **WHEN** any required identity, hash, relation endpoint, schema, or serialization check fails
- **THEN** staging SHALL be discarded or marked rejected
- **AND** the current pointer and all teaching selectors SHALL remain unchanged

### Requirement: Standard candidate import is atomic and round-trip verified
The system MUST stage all standard Bundle records in one transaction, reconstruct every public Artifact and runtime semantic collection from persisted data, and write an immutable `ACCEPTED_CANDIDATE` receipt only after byte, identity, digest and count equality is proven. The import path MUST also record the exact ReleaseSet/import/Delta/capture identities in the snapshot manifest and MUST expose a typed rejection when those identities drift. A valid import MAY be selected by a subsequent explicit Engineering Authority activation without any course-review receipt.

#### Scenario: Standard import completes
- **WHEN** Stage and Round Trip both match the validated Bundle
- **THEN** one accepted non-production candidate ReleaseSet and its complete receipt SHALL become available for explicit Repository and governance reads

#### Scenario: Stage or Round Trip fails
- **WHEN** any write conflict, missing record, byte difference, identity difference, digest difference or count difference is detected
- **THEN** the transaction SHALL roll back and no partial Bundle, Artifact, Release, Projection, object, relation, Crosswalk or receipt SHALL become visible

#### Scenario: Identical Bundle is imported repeatedly
- **WHEN** the same Bundle digest is imported concurrently or repeatedly
- **THEN** the system SHALL return one semantically identical receipt and SHALL NOT duplicate any persisted row

#### Scenario: No CourseCoverage exists
- **WHEN** the Bundle is valid but ACT has no current Teaching Projection or CourseCoverage rows
- **THEN** the engineering snapshot SHALL remain eligible for activation
- **AND** no CourseCoverage worklist SHALL be synthesized
