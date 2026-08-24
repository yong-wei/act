## 1. Production transaction preflight

- [x] 1.1 Re-read the deployed OCI identity, qualification/publication receipts,
  sealed v0.18 targets, complete v0.9 predecessors, marker, lock, and pointer hashes.
- [x] 1.2 Refuse transaction entry on any drift and emit a bounded non-mutating preflight report.
- [x] 1.3 Exercise the exact production rollback path before the forward switch.

## 2. Atomic five-selector cutover

- [x] 2.1 Acquire the exclusive host lock and write, fsync, and re-read the sealed
  write-ahead journal before any pointer mutation.
- [x] 2.2 Advance and verify Authority, Teaching Projection, prerequisite, and
  Authority domain-shard selectors through their existing compare-and-swap stores.
- [x] 2.3 Commit the six-record shared consumer-activation pointer as the sole READY point.

## 3. Production verification and recovery

- [x] 3.1 Verify pointer/receipt closure, 6,843 nodes, 2,811 relations,
  Chinese/fallback labels, no system identifiers, teaching queries, cards,
  infographs, prerequisites, all six consumers, app/worker health, and public readiness.
- [x] 3.2 On any failed observation, restore the complete v0.9 set through the
  journal when identities match; stop and preserve recovery state on concurrent drift.
- [x] 3.3 Re-read every consumer after success or rollback and seal the matching receipt.
- [x] 3.4 Retain v0.9, Legacy, rollback manifests, and immutable history; do not retire them.
- [x] 3.5 Validate final operational artifacts, strict OpenSpec state, and
  independently review the frozen cutover evidence.
