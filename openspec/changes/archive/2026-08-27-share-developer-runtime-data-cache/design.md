## Context

The developer adapter resolves the production active v2 identity, downloads its
manifest and receipt, mounts `runtime/blobs/sha256/` through ossfs2, materializes
a logical view, and binds that view read-only into one checkout. State and Blob
mounts are currently derived from the checkout path. `cache_root()` exists, but
the bootstrap does not configure a persistent ossfs2 data cache, so parallel
worktrees can retrieve identical SHA-addressed bodies independently.

The shared object namespace is immutable, but Release selection is not global:
each running checkout must retain the identity fixed at its own startup.

## Goals / Non-Goals

**Goals:**

- Share immutable Blob bodies and one read-only mount across worktrees.
- Preserve independent checkout Release pins, materialized views, readiness
  receipts, service processes, and shutdown ownership.
- Recover from crashes without unmounting or deleting another checkout's state.
- Bound local disk use without prefetching the complete Runtime.

**Non-Goals:**

- Changing RAM identity, credential storage, OSS namespace, endpoint, v2
  manifest/receipt semantics, production mounts, or active/rollback selection.
- Sharing writable logical Runtime directories between worktrees.
- Introducing ESA into developer Runtime access.

## Decisions

### Key shared state by immutable authority identity

The global mount identity includes account, region, endpoint class, Bucket,
fixed Blob prefix, expected RAM principal, and adapter schema version. Its
repository-external state contains the mountpoint, persistent ossfs2 data-cache
root, options digest, process identity, leases, and recovery status. Credentials
and absolute paths do not enter portable receipts. Sharing by checkout path was
rejected because it preserves duplicate body traffic.

### Keep selection and logical views checkout-owned

Each checkout continues to resolve and pin readiness independently, validate
the exact manifest/receipt, materialize its own logical view, and bind only that
view to its own `course-content/runtime`. Different worktrees may therefore use
different immutable Releases while their identical SHA blobs share cache bytes.
One global logical view was rejected because a production activation could
silently change a running developer service.

### Use a locked acquire/lease/release state machine

Global mount creation and recovery use one machine lock. A checkout acquires a
lease only after the mount source, read-only options, principal identity, and
process are verified. Shutdown removes that checkout's bind and lease after its
services stop; the Blob mount is unmounted only when no live lease remains.
Stale leases are reclaimed only after proving their checkout processes and bind
mount are absent.

### Use persistent on-demand ossfs2 data caching

The mount enables the supported persistent data-cache facility at a stable
repository-external root. Cache policy is on-demand, size-bounded, and scoped to
the SHA Blob mount; manifest/receipt selection remains outside that cache.
Second-read verification observes body-transfer operations rather than assuming
that file presence proves a cache hit. Eagerly mirroring the Runtime was
rejected because it increases first-run traffic and creates a second namespace.

### Fail closed on identity or mount drift

Unexpected source, writable options, different principal, unsupported cache
schema, ambiguous process ownership, or a live unknown bind stops startup.
Recoverable cache corruption invalidates only the affected cache entry and
requires a verified refetch; unknown data is preserved for diagnosis rather
than recursively deleted.

## Risks / Trade-offs

- **One mount becomes a workstation-wide dependency** → verify it on every
  acquire and isolate checkout services behind their own views.
- **Crash leaves stale leases** → reclaim only with process, mount, and checkout
  ownership evidence under the global lock.
- **Persistent cache consumes disk** → expose bounded quota/usage diagnostics
  and deterministic maintenance that never deletes a live view.
- **ossfs2 cache semantics differ by platform/version** → support only qualified
  versions and verify duplicate-read behavior in Linux, WSL2, and the macOS VM.

## Migration Plan

1. Require all old checkout-owned developer mounts to stop cleanly and capture
   their state before enabling the new topology.
2. Create the shared state schema and mount without deleting old cache/state.
3. Start one checkout, then a second worktree against the same Blob and verify
   independent Release receipts plus one body transfer.
4. Make the shared adapter the default only after crash, restart, and shutdown
   recovery pass.
5. Roll back by stopping all new leases and restoring the prior per-checkout
   mount mode; retain shared cache bytes until the audit window ends.

## Open Questions

- Qualified ossfs2 versions and safe cache quota defaults must be established by
  implementation fixtures on each supported Linux execution layer.
