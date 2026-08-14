## MODIFIED Requirements

### Requirement: Runtime releases are immutable after complete publication
The system SHALL publish a v1 release only below `runtime/releases/<release-id>/` as its complete file tree, or a v2 release with its immutable logical manifest and receipt below that release prefix and every file byte below `runtime/blobs/sha256/<sha256>`. It SHALL never overwrite an existing object or publish a mutable `current` tree, and it SHALL not use an OSS directory rename as a release operation. A v1 prefix containing a canonical manifest is complete only after full remote verification. A v2 manifest is complete only after full remote verification of every listed deterministic blob key, size, SHA-256 and logical tree digest. A prefix without a terminal manifest MAY resume only when every existing object is an exact expected member whose remote size and SHA-256 equal the manifest; missing expected objects may then be added. An unexpected or mismatched object SHALL fail closed.

#### Scenario: A new release is uploaded
- **WHEN** every v1 manifest object or v2 manifest blob and the manifest itself are uploaded to the target release prefix
- **THEN** the publisher SHALL re-read the remote object metadata and content needed to verify the exact logical path set, size, SHA-256 metadata and tree digest before reporting the release verified

#### Scenario: Upload is incomplete or modified
- **WHEN** a v1 object or v2 reachable blob is absent, an unexpected object is present, or a remote size or SHA-256 differs from the manifest
- **THEN** verification SHALL fail closed and the release SHALL not be eligible for host selection

### Requirement: Release inspection and rollback are evidence bound
The system SHALL expose inspection of a v1 or v2 release manifest and verification result without revealing credentials. Rollback SHALL select a previously verified immutable release and SHALL not overwrite or delete either release. A v2 host lifecycle record SHALL preserve a normalized rollback identity under the host lock until an explicit successful lifecycle transition retires it.

#### Scenario: Operator requests a prior release
- **WHEN** a requested rollback release has a valid immutable manifest and passes remote verification
- **THEN** the selector SHALL create a new auditable selection generation for that release and preserve the prior active release as rollback until the transition is verified

#### Scenario: Operator requests an unverified release
- **WHEN** a requested release is absent, malformed, or fails remote verification
- **THEN** the selector SHALL leave the current active runtime and protected rollback identity unchanged
