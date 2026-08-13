## ADDED Requirements

### Requirement: Blob-backed runtime manifest is deterministic and complete
The system SHALL generate a versioned, canonical manifest for a blob-backed runtime release. A v2 release document SHALL reside only at `runtime/blob-releases/<release-id>/`, separately from v1 `runtime/releases/<release-id>/`; release identity is therefore the composite of format version, namespace, release ID and manifest SHA-256. A publish-facing v2 operation SHALL resolve `sourceRevision` to one full Git commit and read every input byte only from that commit's `course-content/runtime` Git tree, never from a working-tree fallback. The manifest SHALL enumerate every logical runtime path in strict normalized order and bind each path to an exact non-negative safe-integer size, lowercase SHA-256, and the deterministic key `runtime/blobs/sha256/<sha256>`. It SHALL bind source revision, file count, total bytes, logical tree digest, semantic manifest digest and wire digest. It SHALL reject unsafe paths, duplicate normalized paths, unsupported schema versions, Git symlink or gitlink entries, inconsistent aggregate values and a blob key that is not derived from its file SHA-256.

#### Scenario: Equivalent frozen inputs produce the same logical release identity
- **WHEN** two frozen runtime inputs contain the same source revision, normalized paths and bytes
- **THEN** they produce equal file bindings, tree digest, manifest digests and release ID regardless of publication attempt

#### Scenario: Tampered logical tree is rejected
- **WHEN** a manifest's path, size, SHA-256, blob key or aggregate digest differs from the canonical file bindings
- **THEN** manifest parsing and release verification SHALL fail before materialization or selection

#### Scenario: Working-tree drift cannot affect a Git-bound v2 release
- **WHEN** a caller supplies a valid source commit while its checkout has changed, untracked, filtered or missing runtime files
- **THEN** v2 manifest construction and publish SHALL use only the matching Git tree blobs, or fail before any upload if that tree contains an unsupported or unreadable entry

### Requirement: Initial v1 Release import is fixed and equivalence-proven
The system SHALL permit one explicit `v1-release-import` source mode only for initial migration of a complete existing runtime. Before any write, it SHALL fix the v1 release ID and expected immutable v1 manifest semantic and wire identities; it SHALL not resolve a selector alias or accept an arbitrary local directory. The ECS bridge SHALL read and rehash every v1 manifest object, derive only deterministic v2 blob keys, write the v2 manifest last under its separate namespace, and produce an immutable proof binding both composite release identities, normalized logical tuples, tree digest, file count and total bytes. The import SHALL fail without selection when any source object, manifest identity, path tuple or aggregate differs.

#### Scenario: Fixed v1 source imports into an equivalent v2 candidate
- **WHEN** an operator supplies one verified v1 release ID and its expected manifest identity
- **THEN** the importer SHALL create a non-selectable v2 candidate only after every source object has been rehashed and the complete normalized v1/v2 logical trees are equal

#### Scenario: Selector drift or source mismatch is rejected
- **WHEN** the fixed v1 source manifest changes, a declared source object differs, or an operator attempts to use an active alias or arbitrary directory
- **THEN** the importer SHALL fail before writing a v2 terminal manifest or changing any production selection state

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
The system SHALL persist one durable v2 lifecycle record under the host lock and recovery journal. It SHALL record normalized desired, active, rollback and publishing identities, plus retained leases containing an immutable identity, UTC retention time, signed-media maximum lifetime, derived release deadline and policy version, with a monotonic lifecycle generation. It SHALL preserve desired-versus-active divergence after a failed candidate activation. Garbage collection SHALL compute deletion candidates only from a locked snapshot of that record and verified immutable manifests and receipts for desired, active, rollback, publishing and explicitly retained leases. It SHALL delete a blob only when the blob is absent from that protected reachable set and all selector generations and lifecycle state remain unchanged through revalidation. It SHALL record the input identities, retention leases, candidate set, deletion results and post-operation verification in a GC receipt.

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
- **THEN** the same lifecycle transaction SHALL persist a lease whose deadline equals its UTC retention time plus the repository-controlled maximum signed media URL lifetime, and garbage collection SHALL retain its blobs until that deadline

#### Scenario: Retention lease cannot be shortened or released early
- **WHEN** an operator repeats retention for an identity or requests its release
- **THEN** the lifecycle SHALL only preserve or extend its deadline, and SHALL reject release before that deadline, invalid lease data, or a detected clock rollback

### Requirement: Active media and readiness bind one blob-backed manifest
The active runtime identity, active receipt, media resolver and readiness checks SHALL bind the same release ID, manifest version, semantic digest, wire digest and logical tree digest. A desired identity that diverges after a failed candidate SHALL not replace the active identity for readiness or media signing. The media resolver SHALL sign only a blob key allowlisted by that active manifest, SHALL not expose a permanent OSS URL, and SHALL retain legacy URL fallback when no active-manifest media object exists.

#### Scenario: Cross-release blob reuse preserves private media delivery
- **WHEN** two logical releases refer to the same media SHA-256
- **THEN** the resolver SHALL use the active release's allowlisted manifest binding and generate only a short-lived private redirect for the shared blob

#### Scenario: Stale selector identity fails readiness
- **WHEN** an active selector or receipt identifies a manifest digest different from the materialized runtime manifest
- **THEN** readiness SHALL fail and the system SHALL not report the candidate as active
