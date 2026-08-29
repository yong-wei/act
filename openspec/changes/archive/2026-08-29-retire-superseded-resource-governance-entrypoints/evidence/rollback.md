# Rollback

Rollback for this change is digest-verified restore of exact pre-delete source bytes. It does not write Authority, Teaching Projection, Runtime Release, consumer selectors, production deployment, learning records, or historical artifacts. It does not create a permanent live fallback.

## Rehearsal

Contract tests in `src/lib/resource-governance-retirement/__tests__/resource-governance-retirement.test.ts`:

- Build a rollback archive whose entry digest is SHA-256 of the exact old file bytes.
- Tampered bytes fail `verifyRollbackArchive`.
- `rollbackRetiredEntrypoints` consumes a successful `deleted` receipt and writes only that receipt's archived bytes back through the injected filesystem.
- A later listed-path digest mismatch restores any earlier unlinks from the archive before returning a blocked receipt.
- Directory/glob deletion is refused before any unlink.
- A caller that appears after the scan receipt is issued blocks deletion; no file is removed.

## Live slice

No production entrypoint was unlinked. The rollback identity for retained candidates is the freeze revision `fce5b9fc4a4c7dd408297c3d90d2cf407c953b71`. Future deletion of a narrowed candidate must recapture that file's bytes before unlink.
