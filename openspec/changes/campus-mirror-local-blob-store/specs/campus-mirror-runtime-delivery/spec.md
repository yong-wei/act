## ADDED Requirements

### Requirement: Campus blob store is content-addressed and append-only
The campus mirror SHALL maintain its blob store as `data/runtime/blob-store/sha256/<file-sha256>` with lowercase SHA-256 names bound to content. Blob files SHALL be byte-identical to the same digest in the OSS blob root. The campus sync channel SHALL only add blobs and MUST NOT rewrite, delete, or repurpose existing blobs; campus-side garbage collection is out of scope and defaults to never deleting.

#### Scenario: Repeated incremental syncs converge without rewriting
- **WHEN** the publisher pushes a release whose blob set overlaps prior campus syncs
- **THEN** only blobs absent on campus are transferred, and every pre-existing blob keeps its original bytes and mtime

### Requirement: Campus delivery consumes the identical immutable manifest
Campus activation SHALL reference the same immutable release manifest (release identity, per-file SHA-256 bindings) used by the OSS channel for that release. The campus channel MUST NOT re-derive, relax, or re-sign manifest content; a manifest whose digests fail verification against local blobs SHALL fail closed.

#### Scenario: Tampered or truncated blob blocks activation
- **WHEN** a campus blob's digest mismatches its manifest binding during materialization
- **THEN** activation aborts without switching the current pointer and reports the offending path and digest

### Requirement: Campus materialization reuses the local-blob-root path
Campus views SHALL be produced by the existing materializer driven with a local directory as the blob root, producing the same logical tree, helper leaves, and selector semantics as the ECS blob-view. The application containers on campus SHALL consume the view via read-only bind mounts only.

#### Scenario: Local blob root yields an ECS-equivalent view
- **WHEN** the same release manifest is materialized against the OSS blob root on ECS and against the campus local blob store
- **THEN** both views expose identical logical paths, digests, and current/previous selector behavior

### Requirement: Dual-target publication is same-manifest and independently transacted
Publishing a runtime release SHALL support an OSS target and a campus target that share one immutable manifest while committing independently. A failure or rollback on one target MUST NOT mutate or block the other; each target records its own activation receipt, and campus receipts MUST NOT overwrite ECS active receipts.

#### Scenario: Campus push failure leaves OSS untouched
- **WHEN** the campus rsync or activation fails midway after the OSS publish succeeded
- **THEN** the OSS release and ECS current pointer remain unchanged and the campus retry resumes from missing blobs only

### Requirement: Campus activation is verified and evidenced
Campus activation SHALL verify the manifest against the blob store, materialize to a staging view, run the readiness smoke, and only then switch the campus current pointer under the campus selection lock, writing a campus active receipt that records release identity, manifest digest, and activation evidence.

#### Scenario: Smoke failure rolls back the campus pointer
- **WHEN** the post-materialization smoke fails on campus
- **THEN** the previous campus view stays active, the receipt is not updated, and the failure evidence names the failing check

### Requirement: First campus adoption performs a structural rebuild
The one-time initial adoption MAY ingest the existing dereferenced snapshot as a content source, but campus SHALL reach the standard structure (blob store + linked views + selectors) before any incremental sync is considered authoritative; afterwards snapshot-style dereferenced copies MUST NOT be used as the sync unit.

#### Scenario: Snapshot is replaced by standard structure
- **WHEN** the structural rebuild completes
- **THEN** subsequent campus syncs transfer only manifest-missing blobs and never repack the whole tree
