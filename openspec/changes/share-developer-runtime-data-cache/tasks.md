## 1. Characterize the existing workstation lifecycle

- [ ] 1.1 Freeze the implementation commit and characterize `start`, `stop`, preflight, mount, materialize, bind, receipt, and recovery behavior for Linux, WSL2, and the macOS Linux VM.
- [ ] 1.2 Qualify supported ossfs2 versions and persistent data-cache options, including cache hit evidence, quota behavior, read-only mount inspection, and credential-safe logging.
- [ ] 1.3 Define the machine-global authority identity, state directory, lease schema, lock ownership, and safe migration from checkout-scoped mounts.

## 2. Implement the shared mount and cache

- [ ] 2.1 Implement locked discovery, creation, verification, and reuse of one read-only Blob mount per exact authority/options identity.
- [ ] 2.2 Configure a stable repository-external, persistent, bounded, on-demand ossfs2 data cache without eager Runtime mirroring.
- [ ] 2.3 Implement checkout lease acquisition, heartbeat/process evidence, stale-lease recovery, and final verified unmount.
- [ ] 2.4 Preserve each checkout's independent readiness pin, manifest/receipt validation, materialized view, selection receipt, and read-only bind.

## 3. Integrate startup, shutdown, and recovery

- [ ] 3.1 Update bootstrap/startup so services start only after shared mount verification and checkout-specific selection complete.
- [ ] 3.2 Update shutdown so it stops only the target checkout's services, bind, and lease while preserving other live consumers.
- [ ] 3.3 Add crash, VM restart, stale process, unknown mount, writable drift, corrupt cache entry, and quota-maintenance recovery paths that avoid recursive or cross-worktree deletion.
- [ ] 3.4 Add a reversible transition that restores the prior per-checkout topology if shared mode fails, without deleting the shared cache during the audit window.

## 4. Prove behavior across worktrees

- [ ] 4.1 Test two worktrees pinned to the same Release and prove the second read of one SHA Blob performs no additional OSS body transfer.
- [ ] 4.2 Test two worktrees pinned to different Releases with shared digests and prove their logical views and service identities remain independent.
- [ ] 4.3 Test concurrent start/stop, one-checkout removal, final lease release, crash recovery, cache invalidation/refetch, and unknown-state fail-closed behavior.
- [ ] 4.4 Verify credentials, signed URLs, absolute paths, and writable mounts never enter portable receipts or logs.

## 5. Documentation and gates

- [ ] 5.1 Update collaborator startup/shutdown, diagnostics, cache quota, recovery, and credential-revocation documentation.
- [ ] 5.2 Run focused Python/CLI tests, developer adapter integration fixtures, local typecheck/managed hooks, and strict OpenSpec validation.
- [ ] 5.3 Record supported platform/version evidence and confirm Runtime publication, production FUSE, selectors, and readiness semantics are unchanged.
- [ ] 5.4 Keep verification local for integration PRs and do not add GitHub pull-request CI.
