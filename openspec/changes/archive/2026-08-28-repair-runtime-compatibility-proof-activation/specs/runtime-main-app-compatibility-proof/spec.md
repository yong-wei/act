## MODIFIED Requirements

### Requirement: Compatibility proof binds independently frozen application and Runtime identities
For every newly selected blob-backed Runtime Release, the system SHALL create a canonical, immutable `runtime-app-compatibility.v1` receipt before selector mutation. The receipt SHALL bind the complete `origin/integration` Runtime source revision, Release ID, v2 manifest semantic digest and logical tree digest to the current application's complete `origin/main` revision, immutable loaded image digest, consumer-smoke contract version and canonical applied Prisma migration-set digest. The proof SHALL contain no credential, signed URL, user data, host path or OSS object key. Application and Runtime revisions MAY differ; equal revisions SHALL NOT be a condition of qualification. The canonical receipt SHA-256 SHALL be its immutable proof identity and storage filename, so one Runtime identity MAY retain distinct proofs for independently qualified application image, revision, migration-set or consumer-contract identities.

#### Scenario: One Runtime is qualified under two application images
- **WHEN** the same Runtime manifest passes declared consumers under two different deployed application image identities
- **THEN** the system SHALL retain two separately addressable immutable compatibility proofs
- **AND** it SHALL not overwrite or reinterpret the earlier proof

#### Scenario: Main application consumes an independently frozen Runtime Release
- **WHEN** a candidate Runtime manifest from a frozen `origin/integration` revision passes all declared consumers in the current main application image
- **THEN** the system SHALL write one canonical compatibility receipt for those exact identities before the lifecycle selection transaction begins
- **AND** the receipt SHALL not require the application and Runtime revisions to be equal

#### Scenario: Caller claims an application revision that differs from the image
- **WHEN** an operator argument or local checkout revision differs from the revision embedded in the running application image
- **THEN** the system SHALL reject qualification before writing a compatibility receipt or Runtime selector

### Requirement: Compatibility proof is revalidated under the selection transaction
Immediately before desired or active Runtime lifecycle mutation, the system SHALL re-open and canonical-hash the compatibility receipt and re-read the candidate manifest, current application image digest, embedded application revision, migration-set digest and consumer contract version. It SHALL select the candidate only when all receipt bindings match. On mismatch, missing proof, unreadable proof, or lifecycle drift, it SHALL fail before selector mutation and preserve the existing active and rollback identities. The activation journal and active receipt projection SHALL bind the exact proof SHA-256 used for that selection; crash recovery SHALL use that exact identity rather than inferring a proof from the Runtime identity alone.

#### Scenario: Recovery follows an interrupted qualified selection
- **WHEN** a qualified lifecycle transition commits before its active receipt projection completes
- **THEN** recovery SHALL project the proof SHA-256 recorded by that transition
- **AND** it SHALL not select a different proof for the same Runtime manifest

#### Scenario: Application image changes after candidate qualification
- **WHEN** the running application image digest or embedded revision changes after a candidate compatibility receipt is written
- **THEN** the system SHALL reject selection under the old receipt before desired or active Runtime state changes

#### Scenario: Candidate manifest or migration state drifts
- **WHEN** the candidate manifest identity, migration-set digest or consumer contract differs from the compatibility receipt during selection
- **THEN** the system SHALL fail closed before selector mutation
- **AND** it SHALL retain the prior active and rollback Runtime identities

#### Scenario: Active receipt is inspected by public readiness
- **WHEN** a Runtime Release with a compatibility proof is active
- **THEN** the lifecycle receipt SHALL retain the compatibility receipt identity for audit and recovery
- **AND** public readiness SHALL continue to expose only the existing minimal active Runtime projection
