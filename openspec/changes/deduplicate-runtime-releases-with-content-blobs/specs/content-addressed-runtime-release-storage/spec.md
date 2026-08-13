## ADDED Requirements

### Requirement: Blob-backed runtime manifest is deterministic and complete
The system SHALL generate a versioned, canonical manifest for a blob-backed runtime release. The manifest SHALL enumerate every logical runtime path in strict normalized order and bind each path to an exact non-negative safe-integer size, lowercase SHA-256, and the deterministic key `runtime/blobs/sha256/<sha256>`. It SHALL bind source revision, file count, total bytes, logical tree digest, semantic manifest digest and wire digest. It SHALL reject unsafe paths, duplicate normalized paths, unsupported schema versions, inconsistent aggregate values and a blob key that is not derived from its file SHA-256.

#### Scenario: Equivalent frozen inputs produce the same logical release identity
- **WHEN** two frozen runtime inputs contain the same source revision, normalized paths and bytes
- **THEN** they produce equal file bindings, tree digest, manifest digests and release ID regardless of publication attempt

#### Scenario: Tampered logical tree is rejected
- **WHEN** a manifest's path, size, SHA-256, blob key or aggregate digest differs from the canonical file bindings
- **THEN** manifest parsing and release verification SHALL fail before materialization or selection

### Requirement: Blob publication is append-only and manifest-last
The production release writer SHALL upload a blob only through a conditional no-overwrite operation after verifying the source stream's exact size and SHA-256. A pre-existing blob SHALL be reused only after an independent read verifies the same exact size and SHA-256. The writer SHALL verify every reachable blob before it writes the immutable manifest as the terminal operation, and SHALL not update selectors or receipts for an incomplete release.

#### Scenario: Interrupted publish leaves no selectable release
- **WHEN** a blob upload, remote verification or manifest upload fails
- **THEN** the system SHALL not write a selectable manifest, desired selector or active receipt for that release

#### Scenario: Repeated publish reuses verified blobs
- **WHEN** a later publication requests a blob that was already verified under the same SHA-256 and size
- **THEN** the system SHALL not rewrite the blob and SHALL continue only after exact read verification

### Requirement: Materialized runtime preserves the selected logical release
The system SHALL build a temporary host-owned materialized runtime view only from blobs reachable in one verified manifest. Before selection it SHALL validate every logical entry against that manifest, require the blob mount and materialized view to be read-only to application consumers, and atomically select the view under the host lifecycle lock. The application SHALL continue to receive exactly one read-only bind at `/app/course-content/runtime`.

#### Scenario: Missing or mismatched blob blocks selection
- **WHEN** a selected manifest references a missing blob, a blob with a different size or SHA-256, or a dangling materialized entry
- **THEN** candidate readiness SHALL fail and the prior active runtime SHALL remain selected

#### Scenario: Candidate materialization proves filesystem compatibility
- **WHEN** the materialization strategy is evaluated before production selection
- **THEN** the system SHALL run the declared filesystem-consumer, route, media and textbook-retrieval evidence against the candidate view and SHALL not select it when any required contract differs

### Requirement: Runtime blob garbage collection is reachability-safe
The system SHALL persist one durable v2 lifecycle record under the host lock and recovery journal. It SHALL record normalized desired, active, rollback, publishing and retained identities plus a monotonic lifecycle generation, and SHALL preserve desired-versus-active divergence after a failed candidate activation. Garbage collection SHALL compute deletion candidates only from a locked snapshot of that record and verified immutable manifests and receipts for desired, active, rollback, publishing and explicitly retained releases. It SHALL delete a blob only when the blob is absent from that protected reachable set and all selector generations and lifecycle state remain unchanged through revalidation. It SHALL record the input identities, candidate set, deletion results and post-operation verification in a GC receipt.

#### Scenario: Failed desired candidate preserves active and rollback
- **WHEN** a desired v2 candidate fails mount, materialization, container restart or health verification
- **THEN** the lifecycle record SHALL retain the prior active and rollback identities, record the desired-versus-active divergence, and protect both releases' blobs from garbage collection

#### Scenario: Desired candidate is protected until explicit replacement
- **WHEN** a verified desired candidate is neither active nor rollback
- **THEN** garbage collection SHALL retain its reachable blobs until a committed lifecycle transaction explicitly cancels, replaces or activates that desired identity

#### Scenario: Protected blob cannot be collected
- **WHEN** a blob is reachable from the active, rollback, publishing or retained release manifest
- **THEN** garbage collection SHALL retain the blob regardless of duplicate logical paths in other releases

#### Scenario: Lifecycle drift aborts garbage collection
- **WHEN** a manifest, receipt, selector generation or lifecycle lock state changes after a GC plan is captured
- **THEN** garbage collection SHALL abort before deleting an object and SHALL leave existing protected blobs unchanged

#### Scenario: Retired media release remains reachable through its URL grace period
- **WHEN** a release leaves active or rollback state
- **THEN** garbage collection SHALL retain its blobs until at least the configured maximum signed media URL lifetime has elapsed

### Requirement: Active media and readiness bind one blob-backed manifest
The active runtime identity, active receipt, media resolver and readiness checks SHALL bind the same release ID, manifest version, semantic digest, wire digest and logical tree digest. A desired identity that diverges after a failed candidate SHALL not replace the active identity for readiness or media signing. The media resolver SHALL sign only a blob key allowlisted by that active manifest, SHALL not expose a permanent OSS URL, and SHALL retain legacy URL fallback when no active-manifest media object exists.

#### Scenario: Cross-release blob reuse preserves private media delivery
- **WHEN** two logical releases refer to the same media SHA-256
- **THEN** the resolver SHALL use the active release's allowlisted manifest binding and generate only a short-lived private redirect for the shared blob

#### Scenario: Stale selector identity fails readiness
- **WHEN** an active selector or receipt identifies a manifest digest different from the materialized runtime manifest
- **THEN** readiness SHALL fail and the system SHALL not report the candidate as active
