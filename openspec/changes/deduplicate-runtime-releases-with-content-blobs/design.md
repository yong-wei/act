## Context

`migrate-runtime-to-oss-immutable-releases` establishes `act-runtime-release.v1`: each release owns a complete object prefix and a deterministic manifest. The production pair currently has 10,228 active files and 10,222 rollback files. Every rollback byte is also present in the active tree, but the two release prefixes consume 12,286,210,506 bytes because OSS stores the duplicate bytes twice.

The active application reads `/app/course-content/runtime` through Node filesystem APIs. The host mounts a selected private OSS prefix with ossfs and exposes it read-only to Podman. Media delivery already resolves an allowlisted active-manifest `objectKey` into a short-lived signed redirect. These contracts must remain valid while storage layout changes.

This is a durable storage-format, host-selection, and garbage-collection change. It follows the independent Sol medium decision to establish and prove a content-addressed design before any production switch and not use custom FUSE. The separately authorized current v1 retention policy is outside this change.

## Goals / Non-Goals

**Goals:**

- Store equal runtime file bytes once across every blob-backed release while preserving a separately immutable logical manifest for each release.
- Prove that the selected materialized runtime is equivalent to its manifest for all production filesystem consumers, media resolution, textbook retrieval and readiness checks.
- Permit rollback by selecting a prior manifest without re-uploading its blobs.
- Reclaim only unreachable blobs with an auditable, fail-closed lifecycle protocol.

**Non-Goals:**

- Rewriting runtime consumers to an OSS SDK, implementing a custom FUSE filesystem, making the Bucket public, or persisting OSS signed URLs.
- Changing the existing v1 active/rollback releases, their selectors, or their deletion policy as part of this proposal.
- Treating a blob design as permission for a production cutover. A separate user authorization follows a successful candidate proof.
- Promising exactly one physical copy of every file: different SHA-256 bytes remain distinct blobs, and local materialization/cache metadata has bounded overhead.

## Decisions

### 1. Logical release manifests remain the authority; blobs are storage implementation

Define a versioned blob-backed manifest at `runtime/releases/<release-id>/manifest.json`; the release prefix may contain only that immutable manifest and its receipt. The manifest records the logical runtime tree in canonical path order and binds every logical path to its `sizeBytes`, SHA-256 and the deterministic blob key `runtime/blobs/sha256/<sha256>`. It also records `sourceRevision`, `fileCount`, `totalBytes`, logical tree digest and semantic manifest digest.

The v2 `manifestSha256` is the SHA-256 digest of the versioned canonical semantic projection with its own digest and every transport field excluded. A manifest does not contain a digest of its own final serialized bytes. After final serialization, the publisher records the final `wireSha256`, byte length, manifest object key, release ID, format version and semantic digest in the immutable receipt/locator; readers verify wire identity before parsing and semantic identity after parsing.

The release ID remains content-addressed from the source identity and logical tree digest. A blob key is derived solely from the file SHA-256; a manifest may not name an arbitrary object key. Existing v1 manifests stay readable until a v2 active and rollback pair has passed migration evidence.

This separates logical release identity from physical duplication. `sourceRevision` remains part of release identity, while equal bytes across revisions still reuse the same blob. Keeping `objectKey` in the media-facing parsed manifest preserves the resolver interface while changing its validated value from a release-prefix object to a blob object.

### 2. Publish blobs append-only, then publish the manifest last

The existing single ECS release bridge remains the only production writer. It computes the canonical manifest from a frozen local input, verifies each local stream's size and SHA-256, and writes a blob only with conditional no-overwrite semantics. A conditional conflict is acceptable only after a separate read verifies the exact requested SHA-256 and size.

After every required blob is verified, the bridge writes the immutable manifest as the terminal operation and records a receipt containing its complete reachable blob set. It does not mutate a blob, manifest, active selector or rollback selector. Interrupted publication leaves no selectable manifest; repeated publication of the same release performs only verification for already valid blobs and manifest.

`ossutil sync` is not part of this protocol: its same-prefix incremental comparison does not prove cross-release immutable reuse or defend a release manifest from mutable destination state.

### 3. Use host materialization only after a filesystem-equivalence qualification gate

The candidate design mounts the blob namespace read-only with ossfs and builds a temporary, host-owned logical directory view whose entries refer only to validated blobs. It validates every materialized entry against the selected manifest, then uses a local-filesystem atomic rename and the existing host lock to select the view. Podman continues to receive only one read-only bind at `/app/course-content/runtime`.

A symlink forest is the first candidate because it avoids copying file bytes. It is not assumed equivalent: implementation must first audit all runtime consumer calls involving `lstat`, `readlink`, `realpath`, path containment, directory traversal, file watching, inode assumptions and error handling; then prove the candidate view under ossfs for the published courses and hot indexes. If any required consumer observes incompatible symlink behavior, the change stops before production selection and retains the v1 release-prefix bridge while evaluating a bounded compatible materializer or additional Bucket capacity.

No OSS directory rename, object symlink, custom FUSE, writable container bind, or application-visible blob path is permitted.

### 4. Durable lifecycle state distinguishes desired, active and rollback

V2 introduces one local durable lifecycle record, updated under the existing host lock and recovery journal. It holds a normalized identity for `desired`, `active`, `rollback`, `publishing` and `retained` releases plus a monotonic lifecycle generation and transaction ID. An identity includes release ID, manifest version, semantic/wire digest and logical tree digest. A persistent authority marker defines exactly one recovery mode:

- an absent marker means the host has never migrated and only validated v1 selector/receipt state is authoritative;
- `mode=v2` makes the matching lifecycle record the sole authority, while v1 selector/receipt files are rebuildable compatibility projections;
- `mode=v1-rollback` records a completed explicit v2-to-v1 recovery, making the verified v1 selector/receipt authoritative again.

First migration validates and imports both v1 desired and v1 active identities, including a valid desired-versus-active divergence. It writes a journal after-image and lifecycle record, then commits the `mode=v2` marker. It never writes that marker before all inputs are durable. A v2 marker with missing or invalid lifecycle data must recover only from a matching committed journal; without one it fails closed and must not serve from a stale v1 projection.

On successful activation from A to B, the recovered lifecycle state records B as active and A as rollback. On a failed B candidate, it records B as desired only while retaining A as active and its prior rollback unchanged. Readiness and media signing bind only the active identity; desired-versus-active divergence is an explicit healthy recovery state, not a readiness failure. V2-to-v1 rollback first writes and verifies complete v1 selector/receipt state, then atomically changes the marker to `mode=v1-rollback` through the journal; it never deletes the marker.

### 5. Reachability-based GC protects logical release lifecycle state

The host lifecycle lock covers manifest publication, candidate materialization, activation, rollback and GC. A GC run first captures the durable lifecycle record plus immutable manifests and receipts for desired, active, rollback, currently publishing and explicitly retained releases; it derives the protected blob set from those manifests only. It may delete a blob only when it is absent from that exact protected set and no lifecycle operation is in progress. A desired candidate remains protected until an explicit lifecycle transaction cancels, replaces or activates it. A retired release remains protected for at least the maximum media signed-URL lifetime after it leaves active or rollback state.

GC uses a plan/verify/delete/receipt sequence: immutable input manifest digests and selector generations are recorded before mutation; each candidate is rechecked under the same lock; any selector, manifest, receipt, list-pagination or validation drift aborts before deletion. Deleting manifests requires a separately explicit retention policy; ordinary GC only deletes unreachable blobs. This preserves both logical active and rollback releases without storing duplicate bytes.

### 6. Active selection, media and readiness bind the same manifest

The v2 lifecycle record, active receipt and active selector projection carry release ID, manifest version, semantic/wire digest and logical tree digest. Candidate materialization, `/api/readyz`, media resolution and textbook-retrieval smoke read the active identity only. A desired candidate may legitimately differ from active after failure. The media resolver signs only the validated blob key from the active manifest and retains its legacy URL fallback for a media path absent from the manifest.

Missing blob mounts, hash mismatches, dangling materialized entries, mixed manifest identities or stale selector generations fail readiness and preserve the prior active release. The ECS runtime read role remains read-only; the temporary release operator role is the only writer and its permission remains prefix-scoped.

## Risks / Trade-offs

- [Symlink forest changes a consumer's observable filesystem semantics] → complete callsite audit and candidate runtime/route/retrieval proof are mandatory before selection; do not switch if a required observation differs.
- [Concurrent publish, rollback or GC deletes a needed blob] → one host lock, immutable manifest snapshots, selector-generation fencing and reachable-set revalidation before every delete.
- [Content address incorrectly equates different inputs] → only SHA-256 plus exact size permits reuse; logical tree identity continues to bind each path and release source revision.
- [Blob object listing is paginated or inconsistent] → use continuation-safe listing, record pages in the GC plan, and abort on malformed, duplicate or drifting results.
- [First cold OSS mount regresses textbook retrieval] → benchmark `vectors.f32`, `bodies.utf8` and `lexical-postings.bin` under cold, warm and concurrent access; use only a bounded digest-pinned local hot cache when evidence requires it.
- [20 GB capacity remains inadequate for genuinely changed data] → report release reachability, unique-byte growth and peak spool/materialization requirements before publishing; request capacity expansion rather than weakening immutability or deleting protected data.

## Migration Plan

1. Reconcile the active v1 change into its archived capability spec without changing production selectors.
2. Implement and test blob-backed manifest generation, read-only verification and release receipts in parallel with v1 parsing.
3. Publish a disposable candidate from a frozen source revision, measure dedupe and mount a non-selected materialized view.
4. Complete the filesystem-equivalence, media, route, textbook retrieval, readiness, interrupted publication, concurrent lifecycle and GC safety evidence.
5. Publish a v2 rollback candidate and a v2 active candidate; prove `A active → B active/A rollback → C candidate`, failed candidate recovery and v2-to-v1 rollback paths, then record a capacity report.
6. Request separate user authorization for production selection. Retain v1 releases until the new active/rollback pair and rollback evidence satisfy the declared retention policy.

## Open Questions

- The qualification audit determines whether the symlink forest is compatible. It is a release gate, not a design assumption.
- The implementation must set retention count and minimum free-space thresholds from measured release cadence and unique-byte growth, not from the current two-release sample alone.
