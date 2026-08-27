## MODIFIED Requirements

### Requirement: Runtime mount lifecycle is checkout-owned and recoverable
The developer adapter SHALL serialize machine-global Blob-mount state and
checkout-specific runtime-view state separately. It SHALL record only
credential-free identities, exact owned mount/bind identities, shared-mount
leases, and process evidence; start consumers only after checkout selection;
and stop consumers before releasing that checkout's bind and lease. Cleanup
SHALL affect only resources proven to belong to the target checkout and SHALL
preserve the shared Blob mount while another live lease exists, as well as
unknown paths and other worktrees.

#### Scenario: Normal shutdown releases one checkout
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

## ADDED Requirements

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
