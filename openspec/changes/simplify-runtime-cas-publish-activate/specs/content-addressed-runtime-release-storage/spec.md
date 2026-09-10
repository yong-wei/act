## MODIFIED Requirements

### Requirement: Blob-backed runtime manifest is deterministic and complete
The system SHALL generate a canonical `act-runtime-release.v2` manifest for a blob-backed runtime release. A v2 document SHALL reside at `runtime/blob-releases/<release-id>/manifest.json`. Daily publication SHALL enumerate regular files under the selected runtime directory, bind each file to exact size, lowercase SHA-256, and key `runtime/blobs/sha256/<sha256>`, and record `sourceRevision` only as provenance. It SHALL reject unsafe paths, duplicate normalized paths, unsupported schema versions, inconsistent aggregates, and a blob key that is not derived from its file SHA-256. Parent release identity, Git blob OID matching, and external-input declaration matching SHALL NOT be required to plan or publish a daily release.

#### Scenario: Equivalent frozen inputs produce the same logical release identity
- **WHEN** two publishes use the same `sourceRevision`, normalized paths and bytes
- **THEN** they produce equal file bindings, tree digest, manifest digest and release ID

#### Scenario: Tampered logical tree is rejected
- **WHEN** a manifest's path, size, SHA-256, blob key or aggregate digest differs from the canonical file bindings
- **THEN** manifest parsing SHALL fail before materialization or selection

#### Scenario: Local index avoids unchanged body reads
- **WHEN** a runtime file's path, size and mtime_ns match the local publish index
- **THEN** the publisher SHALL reuse the indexed SHA-256 and blob key
- **AND** it SHALL not read the file body or inspect a parent manifest

### Requirement: Blob publication is append-only and manifest-last
The daily publisher SHALL upload only a newly seen blob through a conditional no-overwrite PUT. An already-existing blob key SHALL be reused as a CAS hit without HEAD or GET. The writer SHALL write the terminal manifest only after Δ blob PUTs succeed, and SHALL NOT update `current` or `previous` during publication. Interrupted publication SHALL leave no selectable pointer change.

#### Scenario: Interrupted publish leaves no selectable release
- **WHEN** a blob upload or manifest upload fails
- **THEN** the system SHALL not write `current` or `previous` for that release

#### Scenario: Repeated publish reuses existing blobs
- **WHEN** a later publication hashes a file to an already-stored SHA-256
- **THEN** the forbid-overwrite PUT SHALL count as a CAS hit
- **AND** the system SHALL not rewrite or remotely inspect that blob

### Requirement: Materialized runtime preserves the selected logical release
The system SHALL build a host-owned materialized runtime view from blobs named by one candidate manifest. Before switching `current` it SHALL confirm only changed or new blob keys are visible, open a fixed sentinel set, and require the view to be read-only to application consumers. It SHALL then atomically select the view by writing `current` to the candidate and `previous` to the outgoing release. The application SHALL continue to receive exactly one read-only bind at `/app/course-content/runtime`. If consumers run, the deployed application SHALL pass readiness and the existing runtime smoke against that view before the pointer commit. A matching application and Runtime Git revision SHALL NOT be required.

#### Scenario: Missing or mismatched blob blocks selection
- **WHEN** a candidate manifest references a missing Δ blob or a dangling materialized entry
- **THEN** activation SHALL reject the candidate
- **AND** the prior `current` view SHALL remain mounted

#### Scenario: Candidate smoke is absent or fails after materialization
- **WHEN** a candidate view is materialized but the deployed application does not pass readiness or declared runtime smoke
- **THEN** the system SHALL not write `current`
- **AND** it SHALL retain the prior Runtime view

### Requirement: Runtime blob garbage collection is reachability-safe
Garbage collection SHALL be an independent operator command and SHALL NOT run during publish, activate, rollback, or application deploy. The default policy SHALL retain blobs. An explicit execute mode SHALL compute deletion candidates only from `current`, `previous`, ClassSession-referenced releases, and pinned releases. It SHALL delete a blob only when the blob is absent from that protected set. Source-proof, bundle parent and git snapshot lineage SHALL NOT be GC inputs.

#### Scenario: Daily publish does not collect blobs
- **WHEN** `runtime:publish` or `runtime:activate` completes
- **THEN** no blob SHALL be deleted
- **AND** `runtime:gc` SHALL not start

#### Scenario: Protected blob cannot be collected
- **WHEN** a blob is reachable from `current`, `previous`, a ClassSession-referenced release, or a pin
- **THEN** garbage collection SHALL retain the blob

### Requirement: Active media and readiness bind one blob-backed manifest
The `current` runtime identity, media resolver and readiness checks SHALL bind the same release ID, manifest digest and logical tree digest. `previous` and unpublished candidates SHALL not replace `current` for readiness, developer discovery or media signing. When blob-backed runtime delivery is required and that binding succeeds, readiness SHALL expose a minimal current runtime projection containing only readiness state, manifest schema, Release ID, canonical manifest digest and logical tree digest. It SHALL NOT expose object keys, logical paths, mount paths, credentials or signed URLs.

#### Scenario: Cross-release blob reuse preserves private media delivery
- **WHEN** two logical releases refer to the same media SHA-256
- **THEN** the resolver SHALL use the current release's allowlisted manifest binding and generate only a short-lived private redirect

#### Scenario: Stale selector identity fails readiness
- **WHEN** the `current` pointer identifies a manifest digest different from the materialized runtime manifest
- **THEN** readiness SHALL fail and omit a usable runtime identity

#### Scenario: Previous release is not projected as current
- **WHEN** `previous` names a different verified release than `current`
- **THEN** readiness SHALL project only the `current` identity

## REMOVED Requirements

### Requirement: Initial v1 Release import is fixed and equivalence-proven
**Reason**: v1 prefix-tree import was a one-time migration. Daily publication is v2 CAS only.
**Migration**: Historical v1 objects remain readable if still referenced. Do not import new v1 releases.

### Requirement: Incremental Runtime publication separates local writes from ECS readback
**Reason**: Daily increment is the local SQLite index plus CAS PUT. ECS readback HEAD/GET was the hot-path cost being removed.
**Migration**: Use `runtime:publish`. Storage-fault proof is `runtime:doctor --full`.

### Requirement: Runtime Release source proof binds textbook corpus admission
**Reason**: Source-proof and textbook bundle identity are authoring/CI concerns, not daily publish gates.
**Migration**: Validate textbook admission in content export/CI. Doctor may audit provenance later.

### Requirement: Formal resource sources use only governed v2 source identities
**Reason**: Formal-resource source identity is not a daily CAS publish qualifier.
**Migration**: Keep formal-resource product contracts on the selected runtime view; do not block publish on source-proof.

### Requirement: Formal resource admission is sealed by the existing v2 release authority
**Reason**: Formal-resource envelopes were bolted onto the retired receipt/lifecycle authority.
**Migration**: Product readers continue to consume the selected view. Do not add a resource-specific current pointer.

### Requirement: Coordinated Runtime Release selection binds the complete graph and resource combination
**Reason**: Coordinated Authority/resource cutover is owned by knowledge-cutover, not the daily Runtime control plane.
**Migration**: Knowledge-cutover may call `runtime:activate` / `runtime:rollback` after its own graph contracts pass. Runtime SHALL NOT host desired/generation/coordinated journals.

### Requirement: Candidate activation validates every textbook in the candidate Release
**Reason**: Activate now uses a fixed sentinel set plus application runtime smoke, not a full textbook corpus replay.
**Migration**: Full corpus audit belongs to doctor or content CI.

### Requirement: Textbook corpus inspection is credential-safe and lifecycle-bound
**Reason**: Inspection was bound to desired/active/rollback lifecycle generation.
**Migration**: Inspect `current` or an explicitly named release without lifecycle generation.

### Requirement: OSS textbook storage, admission and activation are distinct states
**Reason**: This requirement encoded the retired lifecycle vocabulary. Blob sharing remains true by CAS and does not need a separate textbook state machine.
**Migration**: A textbook path is current only when `current`'s manifest names it.

### Requirement: Active readiness binds the formal envelope without exposing governance data
**Reason**: Formal-envelope hash is no longer a Runtime selection authority.
**Migration**: Readiness continues to project only the minimal current release identity.
