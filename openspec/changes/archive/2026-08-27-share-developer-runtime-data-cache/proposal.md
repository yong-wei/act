## Why

`startup:oss-runtime` currently gives every checkout its own ossfs2 Blob mount
and checkout-scoped state, so multiple worktrees can fetch identical immutable
Runtime blobs repeatedly from the public OSS endpoint. The v2 SHA-addressed
namespace permits one workstation-wide read-only data cache while preserving
each checkout's independently pinned active Release and materialized view.

## What Changes

- Replace per-checkout Blob FUSE mounts with one machine-global, read-only mount
  per verified OSS authority identity and Blob prefix.
- Enable a repository-external persistent ossfs2 data cache shared by all ACT
  worktrees on the same supported Linux execution layer.
- Keep Release discovery, manifest/receipt validation, materialized views,
  selection receipts, and `course-content/runtime` binds checkout-specific and
  read-only.
- Add serialized acquisition, leases/reference tracking, crash recovery,
  corruption recovery, bounded cache maintenance, and safe final unmount so one
  checkout cannot remove another checkout's live view or shared cache.
- Prove that a second worktree reading an already cached SHA Blob does not issue
  another OSS body transfer, without eagerly downloading the complete Runtime.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `developer-oss-runtime-access`: Change the developer mount lifecycle from
  checkout-owned Blob mounts to a machine-shared immutable Blob mount and data
  cache while retaining checkout-owned Release selection and views.

## Impact

- **Code:** `scripts/runtime-release/developer-oss/`, its CLI/bootstrap tests,
  `startup:oss-runtime`/`shutdown:oss-runtime` documentation, and safe local
  state migration.
- **Unchanged authority:** production readiness, v2 manifest and receipt,
  `act-runtime-dev-read`, public OSS endpoint, Runtime publication, active and
  rollback selectors, and production FUSE remain unchanged.
- **Local data:** cache and mount state stay outside every repository and expose
  no credential value; removal of one worktree does not delete shared bytes.
- **Verification:** Linux/WSL2/VM lifecycle and duplicate-read tests plus local
  typecheck and focused tests; no pull-request CI is introduced.
