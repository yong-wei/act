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
Standard ReleaseSet import MUST stage a complete immutable Authority Snapshot and MUST NOT replace the current Authority pointer. A separate explicit activation transaction MAY replace that pointer only after round-trip, identity, endpoint, count, and deterministic-hash checks pass. Import and activation MUST NOT consult CourseCoverage or activate teaching consumers.

#### Scenario: Valid stable Release is imported
- **WHEN** a locked Bundle passes compatibility and lossless round-trip checks
- **THEN** a complete staged Authority Snapshot SHALL be written
- **AND** the current pointer SHALL remain unchanged after import until a separate explicit activation succeeds

#### Scenario: Import validation fails
- **WHEN** any required identity, hash, relation endpoint, schema, or serialization check fails
- **THEN** staging SHALL be discarded or marked rejected
- **AND** the current pointer and all teaching selectors SHALL remain unchanged

### Requirement: Standard import is atomic and round-trip verified
The import path MUST record the exact ReleaseSet/import/Delta/capture identities in the snapshot manifest and MUST expose a typed rejection when those identities drift. A valid import MAY be selected by a subsequent explicit Engineering Authority activation without any course-review receipt.

#### Scenario: No CourseCoverage exists
- **WHEN** the Bundle is valid but ACT has no current Teaching Projection or CourseCoverage rows
- **THEN** the engineering snapshot SHALL remain eligible for activation
- **AND** no CourseCoverage worklist SHALL be synthesized
