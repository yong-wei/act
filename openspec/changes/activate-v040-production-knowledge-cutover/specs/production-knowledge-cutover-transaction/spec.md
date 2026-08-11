## ADDED Requirements

### Requirement: Production activation selects one frozen versioned package
The production cutover transaction MUST target one declared application revision, OCI image config digest, source image tar SHA-256, Authority Snapshot, Authority Release, Teaching Projection, prerequisite publication, consumer activation manifest, capture revision, operator tool hash, and deployment-script hash. It MUST reject a mixed identity, missing hash, or a target that differs from the declared `v0.4.0` package before changing any production selector.

#### Scenario: Frozen package is complete
- **WHEN** the target image revision, four selector identities, manifests, receipts, and artifact hashes all match the sealed transaction plan
- **THEN** the transaction SHALL be eligible to stage and activate that package
- **AND** it SHALL retain the exact release and capture identities in its receipt

#### Scenario: Artifact or identity drifts
- **WHEN** a staged Authority artifact, existing runtime artifact, image revision, OCI image config digest, source tar hash, selector target, or capture identity differs from the sealed plan
- **THEN** the transaction SHALL fail closed before writing any production current pointer

### Requirement: Production first activation is all-ABSENT, locked, and recoverable
The transaction MUST acquire one production-exclusive lock, require all four production current pointers to be absent, write and confirm a durable write-ahead journal before its first pointer write, and use identity-constrained compensation on any uncommitted failure. It MUST write the shared consumer pointer last.

#### Scenario: Clean Legacy prestate activates
- **WHEN** Authority, Projection, prerequisite, and consumer pointers are all absent and the sealed staging package validates
- **THEN** the transaction SHALL write Authority, Projection, prerequisite, and consumer selectors in that order
- **AND** it SHALL commit only after all four pointers resolve to the sealed identities

#### Scenario: Interrupted pointer write is recovered
- **WHEN** the process stops after a pointer write but before the journal records a committed transaction
- **THEN** recovery SHALL use the durable journal to remove only matching pointers in reverse order
- **AND** it SHALL retain the journal and fail closed if any pointer identity has drifted

### Requirement: Production consumers cross the boundary together
The app, worker, and other graph consumers MUST remain stopped while artifacts and selectors are staged. They MUST be recreated from the declared immutable image only after the activation receipt is committed and explicit cutover deployment validation succeeds. A normal Legacy-oriented deployment MUST refuse to run while a committed production cutover marker exists.

#### Scenario: Cutover starts successfully
- **WHEN** the four selector post-reads, six consumer readiness records, and activation receipt are valid
- **THEN** the operation SHALL recreate the application and worker from the declared image in cutover mode
- **AND** post-start verification SHALL prove the same image revision, healthy dependencies, six READY consumers, and a successful read-only graph query

#### Scenario: A Legacy deployment is attempted after cutover
- **WHEN** a committed production cutover marker is present
- **THEN** the normal remote deployment command SHALL stop before it stops consumers, syncs runtime, or deletes selectors
- **AND** it SHALL direct the operator to a cutover-aware update or an explicit rollback transaction

#### Scenario: Existing production secrets are retained
- **WHEN** the remote host already has a secret-bearing `.env.server`
- **THEN** the transaction SHALL preserve that file without overwriting or deleting it
- **AND** it SHALL pass the fixed image and explicit `cutover` mode directly to the replacement deployment command

### Requirement: Unrelated selector domains remain independently governed
The production transaction MUST NOT alter Legacy retirement, database candidate-state, Canonical resource-binding readiness, or KAQ selectors. Their state MUST be reported separately and MUST NOT be treated as a failure of a ready versioned graph consumer package.

#### Scenario: Resource binding shadow remains incomplete
- **WHEN** a Canonical resource-binding inventory reports `cutoverReady=false` and its formal consumers remain Legacy
- **THEN** the transaction SHALL leave that selector domain unchanged
- **AND** it SHALL still permit the six separately READY versioned graph consumers to activate when their own gates pass
