## Why

After the cutover-capable runtime and complete candidate have been proven in
production, v0.18 still must be selected through one auditable transaction.
Writing only the Authority pointer would expose a v0.18 graph with v0.9 teaching
semantics; sequential unguarded pointer writes would expose mixed consumer state.

## What Changes

- Re-read the qualified runtime revision, sealed v0.18 candidate identities,
  current v0.9 predecessor identities, production marker, and readiness receipt
  immediately before entering the transaction.
- Exercise the production rollback path, then use the existing exclusive lock,
  write-ahead journal, comparison checks, and atomic stores to advance Authority,
  Teaching Projection, prerequisite, Authority domain-shard, and shared
  consumer-activation selectors.
- Treat the shared consumer-activation pointer as the READY commit point and
  require all six consumers to resolve the same v0.18 Authority and teaching release.
- Verify 6,843 visible nodes, 2,811 relations, admitted Chinese-label behavior,
  teaching queries, graph/RAG/Konling/course/card/path consumers, public readiness,
  worker health, and absence of learner-visible system identifiers.
- Preserve the complete v0.9 release set as the rollback target and restore it
  by identity-constrained transaction on any failed post-switch observation.

## Capabilities

### New Capabilities

- `actkg-v018-production-cutover`: atomically select and verify the qualified
  v0.18 Authority and ACT teaching release set in production with v0.9 rollback.

### Modified Capabilities

- None.

## Impact

- Affects production knowledge selectors, cutover journal/receipts, operational
  verification, and rollback evidence.
- Depends on `publish-actkg-v018-cutover-runtime` and requires a separately
  authorized production operation.
- Does not retire Legacy or delete v0.9 artifacts after a successful switch.
