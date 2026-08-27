# developer-oss-runtime-access Specification

## Purpose
TBD - created by archiving change enable-read-only-oss-runtime-for-developer-workstations. Update Purpose after archive.
## Requirements
### Requirement: Developer workstations discover one production active runtime identity
The developer runtime bootstrap SHALL obtain the production active blob-backed runtime identity from the configured HTTPS readiness endpoint. It SHALL accept only a ready v2 identity containing the expected manifest schema, Release ID, canonical manifest digest and logical tree digest, and SHALL pin that identity for the lifetime of the started development services.

#### Scenario: Development services start against the production active Release
- **WHEN** readiness reports a valid ready v2 runtime identity
- **THEN** bootstrap SHALL select only that Release, persist a credential-free local selection receipt, and keep the same Release until the services are stopped

#### Scenario: Production activates a new Release while development services run
- **WHEN** readiness changes after a development service has fixed its startup identity
- **THEN** the running service SHALL retain its original Release and the next startup SHALL resolve the new production active identity

#### Scenario: Readiness is unavailable or does not prove an active Release
- **WHEN** the endpoint is unavailable, non-HTTPS, not ready, malformed, unknown-version, or lacks any required identity digest
- **THEN** bootstrap SHALL fail before mounting runtime content and SHALL NOT infer the newest Release from OSS object order

### Requirement: Shared workstation credentials are repository-external and read-only
The project SHALL use a dedicated `act-runtime-dev-read` RAM user whose effective permissions are limited to the object reads and prefix-scoped listing required for v2 runtime manifests, receipts and SHA-addressed blobs. The credential SHALL NOT possess runtime publication, mutation, deletion, Bucket administration, RAM, STS, production host or Publisher permissions. All collaborators MAY share the one project-lifetime credential only under the accepted short-term trust boundary.

#### Scenario: Bootstrap receives the expected developer principal
- **WHEN** the configured credential resolves to the expected account and `act-runtime-dev-read` RAM user
- **THEN** bootstrap SHALL continue only after confirming the read-only identity without printing any credential value

#### Scenario: Publisher or unexpected principal is configured
- **WHEN** caller identity is a Publisher, ECS operator, unknown account or any principal other than the declared developer reader
- **THEN** bootstrap SHALL fail before any OSS mount or object request

#### Scenario: Developer credential attempts OSS mutation
- **WHEN** the credential is used to upload, overwrite, copy, multipart-write, change ACLs or delete an OSS object
- **THEN** OSS SHALL deny the operation and the access verification SHALL treat any successful mutation as a blocking least-privilege failure

#### Scenario: Credential storage is unsafe
- **WHEN** a credential path is inside the repository, is a symlink, has unknown fields, or is readable or writable by group/other users
- **THEN** setup and startup SHALL refuse the credential and SHALL NOT copy it to `.env`, logs or another fallback path

### Requirement: Mixed workstations use one Linux runtime contract
The supported developer execution environments SHALL be native Linux, Windows WSL2 and a Linux virtual machine on macOS. ossfs2, the runtime materializer and all development service processes SHALL run in that same Linux environment with a supported architecture, FUSE device and required tools. The workstation SHALL use the public OSS regional endpoint rather than the ECS-only internal endpoint.

#### Scenario: Supported Linux execution layer passes preflight
- **WHEN** Linux, WSL2 or the macOS Linux VM provides the required architecture, `/dev/fuse`, ossfs2, ossutil, mount inspection, Python and Node tools
- **THEN** bootstrap SHALL allow the runtime preparation transaction to begin

#### Scenario: Native macOS, native Windows or incomplete FUSE environment is used
- **WHEN** the application and OSS mount do not share the supported Linux environment or any required preflight check fails
- **THEN** bootstrap SHALL stop with a credential-safe diagnostic and SHALL NOT fall back to a platform-specific unverified mount adapter

### Requirement: Active runtime is verified and materialized without copying the logical tree
Bootstrap SHALL fetch the exact immutable v2 manifest and receipt named by readiness, validate their Release ID, schema, canonical digest, receipt/wire binding, logical tree digest, normalized path set and SHA-derived Blob keys, and mount only `runtime/blobs/sha256/` through ossfs2 with read-only options. It SHALL use the repository materializer to prepare, attach, verify and select a logical view, then expose that view read-only at the checkout's `course-content/runtime` path without deleting or overwriting the checkout directory.

#### Scenario: Active manifest and Blob mount are valid
- **WHEN** the immutable manifest/receipt match readiness and every required mount, materialization and read-only check passes
- **THEN** bootstrap SHALL expose one manifest-bound filesystem view and start the existing development services against it

#### Scenario: Manifest identity or Blob content drifts
- **WHEN** the fetched manifest/receipt differs from readiness, a Blob is absent or mismatched, a materialized link escapes the Blob root, or the selected view receipt differs
- **THEN** bootstrap SHALL fail closed, leave development services stopped, and SHALL NOT select a candidate, previous package or checkout residue

#### Scenario: Mounted runtime is modified through the application path
- **WHEN** a process attempts to create, replace or delete content below the exposed `course-content/runtime`
- **THEN** the filesystem SHALL reject the write and preserve both the immutable OSS objects and hidden checkout directory

#### Scenario: Matching startup is repeated
- **WHEN** the fixed readiness identity, manifest receipt, FUSE source, read-only options, selected view and checkout bind all match a prior completed startup
- **THEN** bootstrap SHALL reuse the verified state without rebuilding or downloading the complete logical runtime

### Requirement: Runtime mount lifecycle is checkout-owned and recoverable
The developer adapter SHALL serialize machine-global Blob-mount state and
checkout-specific runtime-view state separately. It SHALL record only
credential-free identities, exact owned mount/bind identities, shared-mount
leases, and process evidence; start consumers only after checkout selection;
and stop consumers before releasing that checkout's bind and lease. Cleanup
SHALL affect only resources proven to belong to the target checkout and SHALL
preserve the shared Blob mount while another live lease exists, as well as
unknown paths and other worktrees.

#### Scenario: Normal shutdown releases the runtime
- **WHEN** the developer invokes the OSS-aware shutdown command
- **THEN** it SHALL stop that checkout's frontend, worker and scheduler before unmounting its exact bind and releasing its shared-mount lease

#### Scenario: Prior startup crashed
- **WHEN** a new startup finds a receipt, lease or mount left by an interrupted run
- **THEN** it SHALL verify process ownership, mount source, bind identity and live leases, then safely reuse or report the exact cleanup required without recursive deletion

#### Scenario: Another checkout still uses the Blob mount
- **WHEN** one checkout shuts down while another verified live lease remains
- **THEN** the adapter SHALL preserve the shared Blob mount and persistent cache for the remaining checkout

#### Scenario: Final verified lease is released
- **WHEN** no checkout process, bind or lease remains after serialized verification
- **THEN** the adapter MAY unmount the shared Blob mount while preserving the persistent cache and unknown data

### Requirement: Onboarding and revocation separate documentation from Secret delivery
The repository SHALL provide a collaborator guide containing platform preparation, credential installation, identity verification, startup, shutdown, diagnostics and revocation cleanup without any real AccessKey, Secret, signed URL or credential-bearing command history. The user SHALL distribute the actual credential through a repository-external password manager or end-to-end encrypted channel only after one controlled real-environment smoke succeeds.

#### Scenario: Collaborator receives access
- **WHEN** the implementation and controlled RAM smoke have passed
- **THEN** the collaborator SHALL receive the credential-free guide through normal project channels and the Secret through a separate controlled channel

#### Scenario: Project ends or credential is suspected leaked
- **WHEN** access must end
- **THEN** the operator SHALL delete the AccessKey first, verify that new mounts are denied, remove the RAM user or policy binding, and direct collaborators to remove local credential and mount state

### Requirement: Public OSS use is bounded and observable
The developer runtime adapter SHALL read objects on demand through the public regional OSS endpoint and SHALL avoid a complete eager runtime copy. It SHALL report credential-free Release identity, cache/mount state, transferred operation class and actionable latency failures without logging object URLs containing authorization data or any credential value.

#### Scenario: A lesson opens after successful startup
- **WHEN** the application reads a runtime file that is not present in the local FUSE cache
- **THEN** ossfs2 SHALL retrieve that Blob on demand and the application SHALL observe the manifest-declared bytes through the filesystem path

#### Scenario: Public endpoint latency is unacceptable
- **WHEN** recorded course, media or textbook retrieval smoke exceeds the accepted development threshold
- **THEN** the implementation MAY enable only a manifest-digest-bound local cache and SHALL NOT copy or publish a second OSS runtime namespace

### Requirement: Immutable Blob mount and data cache are workstation-shared
All ACT worktrees in the same supported Linux execution layer SHALL share one
read-only ossfs2 mount and one repository-external persistent data cache for an
identical verified account, region, endpoint class, Bucket, RAM principal, Blob
prefix, adapter schema, and mount-options identity. A mismatch SHALL create a
separate qualified identity or fail before reuse.

#### Scenario: Two worktrees use the same Blob authority
- **WHEN** both worktrees pass principal and mount preflight for the same immutable Blob namespace
- **THEN** they SHALL acquire leases on one verified read-only mount and data-cache identity

#### Scenario: Existing global mount identity drifts
- **WHEN** source, endpoint, principal, prefix, options, process, or writability differs from the expected shared identity
- **THEN** startup SHALL fail before binding Runtime content or starting services

### Requirement: Shared caching remains on-demand and transfer-verifiable
The shared data cache SHALL retrieve a SHA-addressed Blob only when a consumer
reads it, SHALL use a bounded cache policy, and SHALL expose credential-safe
operation evidence sufficient to distinguish an OSS body transfer from a local
cache read. It SHALL NOT eagerly mirror the complete Runtime namespace.

#### Scenario: First worktree reads an uncached Blob
- **WHEN** the Blob is absent from the qualified persistent cache
- **THEN** ossfs2 SHALL fetch it on demand and record one body-transfer operation class without exposing authorization data

#### Scenario: Second worktree reads the same cached Blob
- **WHEN** the identical verified Blob remains in the shared cache
- **THEN** the read SHALL return the manifest-declared bytes without another OSS body transfer

### Requirement: Checkout Release selection remains independent
Each checkout SHALL continue to resolve, pin, validate, materialize, select, and
bind its own active Release identity even when Blob bodies are shared. A
production readiness change or another checkout's startup/shutdown MUST NOT
change the Release used by already running services.

#### Scenario: Worktrees pin different immutable Releases
- **WHEN** two worktrees start at different readiness observations whose manifests share some Blob digests
- **THEN** each SHALL retain its own logical view while shared digests reuse the same mount and cache bytes

#### Scenario: Production active Release changes
- **WHEN** readiness changes while a checkout is running
- **THEN** that checkout SHALL retain its fixed Release and only a later startup SHALL select the newer identity

### Requirement: Shared state and cache recover without cross-worktree loss
Global acquire, lease mutation, stale-state recovery, maintenance, and final
unmount SHALL run under a machine lock. Cache corruption SHALL invalidate or
refetch only proven affected cache data; maintenance MUST NOT delete a live
checkout view, an active bind, unknown data, credentials, or another
worktree's state.

#### Scenario: Stale lease is discovered
- **WHEN** its recorded checkout processes and bind are both proven absent
- **THEN** recovery SHALL reclaim only that lease and preserve every live lease and shared cache byte

#### Scenario: Cached entry fails verified read
- **WHEN** an affected Blob cannot produce the manifest-declared size and SHA-256
- **THEN** the adapter SHALL fail the consumer read, invalidate or quarantine only the proven cache entry, and require a verified refetch before reuse

