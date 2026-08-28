# oss-runtime-release-management Specification

## Purpose
Define immutable v1 prefix-tree and v2 blob-backed runtime publication, inspection, and evidence-bound rollback.
## Requirements
### Requirement: Runtime release manifest is deterministic and complete
The system SHALL produce an `act-runtime-release.v1` manifest from an explicitly selected runtime source directory. The manifest SHALL record the source Git revision, release id, file count, total bytes, deterministic tree digest, and for every regular file a normalized relative path, size, and SHA-256 digest.

#### Scenario: Equivalent runtime trees are manifested twice
- **WHEN** two manifest runs receive the same release id, source revision, and byte-identical runtime tree
- **THEN** they SHALL emit byte-identical canonical manifest content and the same tree digest.

#### Scenario: Unsafe runtime path is encountered
- **WHEN** the selected runtime source contains a symlink, non-regular file, absolute path, traversal path, duplicate normalized path, or a path outside the selected root
- **THEN** manifest generation SHALL fail before it emits a publishable release manifest.

### Requirement: Runtime releases are immutable after complete publication
The system SHALL publish a v1 release only below `runtime/releases/<release-id>/` as its complete file tree, or a v2 release with its immutable logical manifest and receipt below that release prefix and every file byte below `runtime/blobs/sha256/<sha256>`. It SHALL never overwrite an existing object or publish a mutable `current` tree, and it SHALL not use an OSS directory rename as a release operation. A v1 prefix containing a canonical manifest is complete only after full remote verification. A v2 daily publication is complete after validating its manifest/receipt identities, source delta, and every changed or unknown blob's exact size and SHA-256 metadata; when all three immutable metadata fields are absent for an exact SHA-addressed legacy blob, it MAY instead complete one HEAD-ETag-bound `get-object --if-match` readback that proves the manifest size and SHA-256 without mutating that blob. Parent-manifest inherited blobs SHALL not be re-read or re-HEADed. A separate sample or full audit SHALL verify inherited blob bodies. A prefix without a terminal manifest MAY resume only when every existing changed/unknown object is an exact expected member whose remote size and SHA-256 metadata equal the manifest, or is a metadata-less legacy blob that completes the same conditional readback proof; missing expected objects may then be added. An unexpected, partial-metadata or mismatched object SHALL fail closed.

#### Scenario: A new release is uploaded
- **WHEN** every v1 manifest object and the v1 manifest itself are uploaded to the target `runtime/releases/<release-id>/` prefix
- **THEN** the publisher SHALL re-read the remote object metadata and content needed to verify the exact path set, size, SHA-256 metadata and tree digest before reporting the v1 release verified

#### Scenario: A small v2 delta is uploaded
- **WHEN** a v2 target manifest has a validated parent and only a subset of source identities changed
- **THEN** the publisher SHALL read and verify only that subset, publish only unknown blob keys, preserve a complete manifest for the whole logical tree, and record body bytes hashed, metadata requests and uploaded bytes in its receipt

#### Scenario: Full audit is requested
- **WHEN** an operator invokes a v2 full audit after initial import, suspected storage fault or a scheduled audit window
- **THEN** the verifier SHALL read every unique reachable blob body, recompute SHA-256 and fail closed on any mismatch without changing a selection

#### Scenario: Upload is incomplete or modified
- **WHEN** a v1 object or v2 reachable blob is absent, an unexpected object is present, or a remote size or SHA-256 differs from the manifest
- **THEN** verification SHALL fail closed and the release SHALL not be eligible for host selection

#### Scenario: Metadata-less legacy object is conditionally proved
- **WHEN** a changed or unknown v2 blob exists at its exact SHA-addressed key with all immutable metadata fields absent
- **THEN** publication SHALL reuse it only after its HEAD ETag-bound readback proves the manifest size and SHA-256, records the evidence, and performs no mutation for that object

### Requirement: Source-authoritative release transport does not stage a second runtime tree
When the content-authoritative runtime directory is not the ECS legacy runtime directory, the system SHALL permit a publisher transport that reads only the frozen source manifest members and streams them through the ECS publisher identity without writing a complete runtime staging copy on ECS. It SHALL pass only validated path and object-key arguments to the remote process, write the canonical manifest last, and leave the runtime selector, mount, container, and legacy runtime unchanged.

#### Scenario: ECS legacy runtime differs from the content authority
- **WHEN** the ECS local runtime tree digest differs from the declared source manifest tree digest
- **THEN** the system SHALL reject ECS local runtime as an upload source and SHALL not overwrite or rsync the live legacy runtime to make it match.

#### Scenario: Stream is interrupted
- **WHEN** source reading, SSH transport, or the ECS object upload terminates before all manifest members complete
- **THEN** the release prefix SHALL remain without a canonical manifest, SHALL not be selectable, and subsequent publication MAY add only missing manifest members after exact remote verification of every pre-existing member.

### Requirement: Release inspection and rollback are evidence bound
The system SHALL expose inspection of a v1 or v2 release manifest and verification result without revealing credentials. Rollback SHALL select a previously verified immutable release and SHALL not overwrite or delete either release. A v2 host lifecycle record SHALL preserve a normalized rollback identity under the host lock until an explicit successful lifecycle transition retires it. Publication, runtime deployment and application deployment SHALL be independently invocable: a runtime-only operation SHALL not build or transfer an application image, export/import a database, run a Prisma migration, rewrite Nginx/systemd configuration or copy a complete runtime tree. A production application release SHALL freeze one complete `origin/main` revision and a distinct application release version before image build; a Runtime Release SHALL freeze one complete `origin/integration` revision and an independent Runtime Release identity. A Runtime selection SHALL require the matching verified runtime-app compatibility proof for the current deployed application image, rather than equality between the application and Runtime revisions.

#### Scenario: Operator requests a prior release
- **WHEN** a requested rollback release has a valid immutable manifest and passes remote verification
- **THEN** the selector SHALL create a new auditable selection generation for that release and preserve the prior active release as rollback until the transition is verified

#### Scenario: Operator requests an unverified release
- **WHEN** a requested release is absent, malformed, or fails remote verification
- **THEN** the selector SHALL leave the current active runtime and protected rollback identity unchanged

#### Scenario: Runtime source differs from the current application revision
- **WHEN** an independently frozen `origin/integration` Runtime candidate has a different revision from the current deployed `origin/main` application
- **THEN** the runtime-only workflow SHALL permit selection only after its matching compatibility proof passes
- **AND** it SHALL not rebuild, transfer, replace or roll back the application image

### Requirement: Legacy first-cutover tooling is not a daily Runtime deployment path
The system SHALL identify the historical first-cutover command that binds an application revision to the Runtime integration revision as migration-only tooling. The standard `deploy:runtime` path SHALL use the blob Runtime lifecycle and SHALL reject routing through that migration command for ordinary Runtime publication.

#### Scenario: Daily Runtime deployment is requested
- **WHEN** an operator invokes the standard Runtime deployment command for a new Runtime Release
- **THEN** the system SHALL use the v2 blob Runtime publication, compatibility qualification and lifecycle selection path
- **AND** it SHALL not derive the application image revision from the Runtime source revision

#### Scenario: A migration-only command is invoked without migration intent
- **WHEN** a caller attempts to use the first-cutover command as a daily Runtime deployment shortcut
- **THEN** the command SHALL fail before application-image or selector mutation and direct the caller to the standard Runtime path

