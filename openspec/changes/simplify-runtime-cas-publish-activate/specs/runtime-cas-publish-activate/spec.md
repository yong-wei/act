## ADDED Requirements

### Requirement: Daily publisher hashes only metadata-changed files
The daily Runtime publisher SHALL scan `course-content/runtime` file metadata and consult a local SQLite index of `path`, `size`, `mtime_ns`, and `sha256`. It SHALL compute SHA-256 only for files whose metadata differs from the index, or for every file when `--bootstrap` is explicit. It SHALL NOT read file bodies for unchanged metadata. A missing or unreadable index during an ordinary publish SHALL fail closed with `local publish index unavailable` and `run with --bootstrap to rebuild`; it SHALL NOT silently rebuild or fully hash.

#### Scenario: Unchanged runtime is published again
- **WHEN** the operator runs ordinary `runtime:publish` against a runtime tree whose path/size/mtime_ns all match the local index and the same `sourceRevision`
- **THEN** the publisher SHALL report `hashed=0` and `uploaded=0`
- **AND** it SHALL issue no blob body read, no OSS HEAD, and no OSS GET

#### Scenario: One JSON file changes
- **WHEN** exactly one runtime file has a different size or mtime_ns
- **THEN** the publisher SHALL hash only that file
- **AND** it SHALL conditionally PUT at most that file's unique blob plus a new immutable manifest if the release identity changed

#### Scenario: Ordinary publish finds no index
- **WHEN** `var/cache/runtime-release/index.sqlite` is absent or unreadable and `--bootstrap` is not supplied
- **THEN** the publisher SHALL exit non-zero before hashing or uploading
- **AND** the error text SHALL tell the operator to rebuild with `--bootstrap`

### Requirement: Blob writes are conditional CAS puts without preflight
The publisher SHALL upload a blob only by a no-overwrite PUT to `runtime/blobs/sha256/<sha256>`. A successful create SHALL count as an upload. An already-existing object SHALL count as a CAS hit and SHALL NOT be treated as failure. The publisher SHALL NOT HEAD or GET blobs to decide reuse. It SHALL write the current `act-runtime-release.v2` manifest last under `runtime/blob-releases/<releaseId>/manifest.json` and SHALL NOT invent a new manifest schema.

#### Scenario: Second put of an existing blob is a hit
- **WHEN** a changed file hashes to a SHA-256 whose blob key already exists
- **THEN** the forbid-overwrite PUT SHALL be accepted as a CAS hit
- **AND** the publisher SHALL not overwrite, HEAD, or GET that object

#### Scenario: Manifest remains the current v2 document
- **WHEN** the publisher finishes a successful release
- **THEN** consumers that already parse `act-runtime-release.v2` SHALL accept the manifest
- **AND** every file `objectKey` SHALL equal `runtime/blobs/sha256/<sha256>`

### Requirement: Activation keeps only current and previous pointers
Runtime activation SHALL persist exactly two selection pointers: `current` and `previous`. It SHALL compare the candidate manifest with the current manifest, confirm only changed or new blob keys are visible, materialize the candidate view, open a fixed sentinel set, and then atomically set `current` to the new release and `previous` to the old current. It SHALL NOT require desired, staged, verified, publishing, generation, or transaction-marker state. `runtime:rollback` SHALL swap `current` and `previous` without uploading blobs or rehashing the inherited tree.

#### Scenario: Activate switches the live pointer
- **WHEN** a published candidate has visible Δ blobs and readable sentinels
- **THEN** one `runtime:activate` command SHALL make that release `current`
- **AND** the previous `current` SHALL become `previous`

#### Scenario: Rollback restores the prior release
- **WHEN** the operator runs `runtime:rollback` while `previous` names a readable release
- **THEN** the two pointers SHALL swap
- **AND** the command SHALL NOT upload blobs or hash unchanged files

#### Scenario: Candidate is not ready
- **WHEN** a Δ blob is missing or a required sentinel cannot be read
- **THEN** activation SHALL leave `current` unchanged
- **AND** it SHALL NOT write a partial pointer update

### Requirement: Full verify and GC stay off the hot path
`runtime:publish`, `runtime:activate`, `runtime:rollback`, and application deploy SHALL NOT invoke full manifest closure, full OSS HEAD/GET, full blob hash, source-proof, parent verification, or garbage collection. `runtime:doctor --full` MAY perform those audits only when an operator explicitly requests them. `runtime:gc` SHALL be an independent command; the default policy SHALL retain blobs. A later execute mode SHALL retain `current`, `previous`, ClassSession-referenced releases, and pinned releases.

#### Scenario: Daily publish does not call doctor
- **WHEN** `runtime:publish` or `runtime:activate` runs successfully
- **THEN** the process graph SHALL NOT start `runtime:doctor` or `runtime:gc`
- **AND** no full blob existence scan SHALL run

#### Scenario: Doctor is explicit
- **WHEN** an operator runs `runtime:doctor --full` for a named release
- **THEN** the tool MAY read the complete manifest closure and rehash reachable blobs
- **AND** it SHALL NOT change `current` or `previous`

### Requirement: Authoring export does not rewrite identical bytes
`export_runtime.py` SHALL write a runtime file only when the new bytes differ from the existing file. Identical content SHALL leave the existing inode mtime unchanged.

#### Scenario: Unrelated lesson files keep their mtime
- **WHEN** a single lesson export produces byte-identical output for other runtime files
- **THEN** those files SHALL not be rewritten
- **AND** a later publisher scan SHALL treat them as unchanged metadata
