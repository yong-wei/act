## ADDED Requirements

### Requirement: Runtime release manifest is deterministic and complete
The system SHALL produce an `act-runtime-release.v1` manifest from an explicitly selected runtime source directory. The manifest SHALL record the source Git revision, release id, file count, total bytes, deterministic tree digest, and for every regular file a normalized relative path, size, and SHA-256 digest.

#### Scenario: Equivalent runtime trees are manifested twice
- **WHEN** two manifest runs receive the same release id, source revision, and byte-identical runtime tree
- **THEN** they SHALL emit byte-identical canonical manifest content and the same tree digest.

#### Scenario: Unsafe runtime path is encountered
- **WHEN** the selected runtime source contains a symlink, non-regular file, absolute path, traversal path, duplicate normalized path, or a path outside the selected root
- **THEN** manifest generation SHALL fail before it emits a publishable release manifest.

### Requirement: Runtime releases are immutable after complete publication
The system SHALL publish a release only below `runtime/releases/<release-id>/` and SHALL reject a release id whose prefix already contains a manifest or runtime object. It SHALL not publish a mutable `current` tree or use an OSS directory rename as a release operation.

#### Scenario: A new release is uploaded
- **WHEN** every manifest object and the manifest itself are uploaded to the target release prefix
- **THEN** the publisher SHALL re-read the remote object metadata and content needed to verify the exact path set, size, SHA-256 metadata and tree digest before reporting the release verified.

#### Scenario: Upload is incomplete or modified
- **WHEN** a manifest object is absent, an unexpected object is present, or a remote size or SHA-256 differs from the manifest
- **THEN** verification SHALL fail closed and the release SHALL not be eligible for host selection.

### Requirement: Release inspection and rollback are evidence bound
The system SHALL expose inspection of a release manifest and verification result without revealing credentials. Rollback SHALL select a previously verified immutable release and SHALL not overwrite or delete either release.

#### Scenario: Operator requests a prior release
- **WHEN** a requested rollback release has a valid immutable manifest and passes remote verification
- **THEN** the selector SHALL create a new auditable selection generation for that release.

#### Scenario: Operator requests an unverified release
- **WHEN** a requested release is absent, malformed, or fails remote verification
- **THEN** the selector SHALL leave the current active runtime unchanged.
