## Why

Release `v0.4.0` contains a completed, capture-bound ActKG → ACT first-activation package, but the normal remote deployment path deliberately removes its selectors and launches the production readers in Legacy mode. The explicitly authorized production cutover therefore needs a distinct transaction that preserves the immutable `v0.4.0` application image while making the selector change auditable and recoverable.

## What Changes

- Add a production data-plane first-activation transaction for the fixed `v0.4.0` / `58f70df` image and its already verified Authority Snapshot, Teaching Projection, prerequisite publication, and six-consumer activation manifest.
- Stage and hash-verify the missing Authority artifacts, validate the existing runtime artifacts, and commit all four production `current.json` selectors through a write-ahead, identity-constrained transaction with the consumer selector last.
- Persist a production transaction plan, journal, receipt, and recovery metadata; restart app and worker only after the full selector set is valid in explicit `cutover` mode.
- Reject normal Legacy-oriented deployment while this production cutover receipt is active, rather than deleting or silently bypassing its selectors.
- Preserve Legacy readers and historical evidence; this change does not retire them or alter Canonical resource-binding/KAQ selectors that have independent readiness gates.

## Capabilities

### New Capabilities

- `production-knowledge-cutover-transaction`: staged, hash-sealed, reversible production activation of an already verified versioned knowledge package.

### Modified Capabilities

- None.

## Impact

- Affected code: production cutover operator tooling, `scripts/remote-deploy.sh` safety gate, focused deployment/transaction tests, and OpenSpec records.
- Affected systems: the remote host Authority/runtime mounts, app and worker containers, and the fixed `v0.4.0` image deployment configuration, bound by OCI config digest and source tar SHA-256.
- No new image or graph content is released; the operation targets the immutable `58f70df` image and retains the existing database candidate/shadow records.
