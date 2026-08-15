## MODIFIED Requirements

### Requirement: Runtime releases are immutable after complete publication
The system SHALL publish a v1 release only below `runtime/releases/<release-id>/` as its complete file tree, or a v2 release with its immutable logical manifest and receipt below that release prefix and every file byte below `runtime/blobs/sha256/<sha256>`. It SHALL never overwrite an existing object or publish a mutable `current` tree, and it SHALL not use an OSS directory rename as a release operation. A v1 prefix containing a canonical manifest is complete only after full remote verification. A v2 daily publication is complete after validating its manifest/receipt identities, source delta, and every changed or unknown blob's exact size and SHA-256 metadata; when all three immutable metadata fields are absent for an exact SHA-addressed legacy blob, it MAY instead complete one HEAD-ETag-bound `get-object --if-match` readback that proves the manifest size and SHA-256 without mutating that blob. Parent-manifest inherited blobs SHALL not be re-read or re-HEADed. A separate sample or full audit SHALL verify inherited blob bodies. A prefix without a terminal manifest MAY resume only when every existing changed/unknown object is an exact expected member whose remote size and SHA-256 metadata equal the manifest, or is a metadata-less legacy blob that completes the same conditional readback proof; missing expected objects may then be added. An unexpected, partial-metadata or mismatched object SHALL fail closed.

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

### Requirement: Release inspection and rollback are evidence bound
The system SHALL expose inspection of a v1 or v2 release manifest and verification result without revealing credentials. Rollback SHALL select a previously verified immutable release and SHALL not overwrite or delete either release. A v2 host lifecycle record SHALL preserve a normalized rollback identity under the host lock until an explicit successful lifecycle transition retires it. Publication, runtime deployment and application deployment SHALL be independently invocable: a runtime-only operation SHALL not build or transfer an application image, export/import a database, run a Prisma migration, rewrite Nginx/systemd configuration or copy a complete runtime tree.

#### Scenario: Operator requests a prior release
- **WHEN** a requested rollback release has a valid immutable manifest and passes remote verification
- **THEN** the selector SHALL create a new auditable selection generation for that release and preserve the prior active release as rollback until the transition is verified

#### Scenario: Operator requests an unverified release
- **WHEN** a requested release is absent, malformed, or fails remote verification
- **THEN** the selector SHALL leave the current active runtime and protected rollback identity unchanged
