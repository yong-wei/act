## MODIFIED Requirements

### Requirement: Runtime release manifest is deterministic and complete
The system SHALL produce an `act-runtime-release.v2` manifest from the selected `course-content/runtime` directory. The manifest SHALL record a provenance Git SHA as `sourceRevision`, a content-addressed `releaseId`, file count, total bytes, deterministic tree digest, and for every regular file a normalized relative path, size, SHA-256, and blob object key. File `source` identity SHALL be optional and SHALL NOT be required to publish. The publisher SHALL hash only files whose local index metadata changed, except during explicit `--rebuild-index`. `--bootstrap` SHALL create or repair a missing index without wiping a valid one.

#### Scenario: Equivalent runtime trees are manifested twice
- **WHEN** two manifest runs receive the same `sourceRevision` and byte-identical runtime tree
- **THEN** they SHALL emit byte-identical canonical manifest content and the same tree digest

#### Scenario: Unsafe runtime path is encountered
- **WHEN** the selected runtime source contains a symlink, non-regular file, absolute path, traversal path, duplicate normalized path, or a path outside the selected root
- **THEN** manifest generation SHALL fail before it emits a publishable release manifest

#### Scenario: Unchanged files are not rehashed
- **WHEN** a file's path, size and mtime_ns match the local publish index
- **THEN** the publisher SHALL reuse the stored SHA-256 without reading the file body

### Requirement: Runtime releases are immutable after complete publication
The system SHALL publish a v2 release by conditionally writing blobs at `runtime/blobs/sha256/<sha256>` and writing the terminal manifest at `runtime/blob-releases/<release-id>/manifest.json`. It SHALL never overwrite an existing blob or publish a mutable `current` tree. An already-existing blob key SHALL be a CAS hit. Daily publication SHALL NOT HEAD or GET blobs, SHALL NOT require a parent manifest, and SHALL NOT re-read inherited blob bodies. A release is complete after Δ blob PUTs succeed and the terminal manifest is written. Full closure audit SHALL be reserved for `runtime:doctor --full`.

#### Scenario: A new release is uploaded
- **WHEN** changed unique blobs and the terminal manifest are conditionally written
- **THEN** the publisher SHALL report the release published without reading unchanged blob bodies

#### Scenario: A small delta is uploaded
- **WHEN** only a subset of runtime files changed in the local index
- **THEN** the publisher SHALL hash and upload only that subset's new blobs
- **AND** it SHALL still emit a complete logical manifest for the whole tree

#### Scenario: Full audit is requested
- **WHEN** an operator invokes `runtime:doctor --full` after suspected storage fault or a scheduled audit
- **THEN** the verifier MAY read reachable blob bodies and recompute SHA-256
- **AND** it SHALL fail closed on mismatch without changing `current` or `previous`

#### Scenario: Upload is incomplete
- **WHEN** a required new blob PUT fails or the terminal manifest is not written
- **THEN** the release SHALL not be eligible for activation
- **AND** `current` SHALL remain unchanged

### Requirement: Release inspection and rollback are evidence bound
The system SHALL expose inspection of a v2 release manifest without revealing credentials. Rollback SHALL swap the `current` and `previous` pointers and SHALL NOT overwrite or delete either release. Publication, runtime activation and application deployment SHALL be independently invocable. A runtime-only operation SHALL not build or transfer an application image, export/import a database, run a Prisma migration, or rewrite Nginx/systemd configuration. Application deploy SHALL NOT accept `DEPLOY_SCOPE=all` as a runtime-publishing mode.

#### Scenario: Operator requests a prior release
- **WHEN** `runtime:rollback` runs and `previous` names a readable immutable release
- **THEN** that release SHALL become `current` and the former `current` SHALL become `previous`

#### Scenario: Operator requests an unverified release
- **WHEN** a requested activate target is absent, malformed, or missing a Δ blob or sentinel
- **THEN** the selector SHALL leave `current` and `previous` unchanged

#### Scenario: Runtime source differs from the current application revision
- **WHEN** an independently published Runtime candidate has a different provenance SHA from the deployed application
- **THEN** activation MAY proceed after Δ blob, sentinel and application runtime smoke checks pass
- **AND** it SHALL not rebuild or replace the application image

### Requirement: Legacy first-cutover tooling is not a daily Runtime deployment path
The system SHALL identify historical first-cutover, publisher-bridge orchestration, and complex lifecycle commands as retired. The standard daily path SHALL be `runtime:publish` then `runtime:activate`. Application deploy scripts SHALL reject any remaining all-scope or first-cutover shortcut that claims to publish Runtime.

#### Scenario: Daily Runtime deployment is requested
- **WHEN** an operator publishes and activates a new Runtime Release
- **THEN** the system SHALL use the CAS publisher and current/previous activation
- **AND** it SHALL not route through publisher-bridge lifecycle orchestration

#### Scenario: A retired combined deploy scope is invoked
- **WHEN** a caller attempts to use `DEPLOY_SCOPE=all` or the first-cutover command as a daily Runtime shortcut
- **THEN** the command SHALL fail before selector mutation
- **AND** it SHALL direct the caller to `runtime:publish` and `runtime:activate`

## REMOVED Requirements

### Requirement: Source-authoritative release transport does not stage a second runtime tree
**Reason**: Daily publication now reads the local runtime tree and writes CAS blobs directly. The ECS streaming transport and second staging copy were part of the retired publisher bridge.
**Migration**: Use `runtime:publish`. Do not rsync or stage a complete runtime tree on ECS.
