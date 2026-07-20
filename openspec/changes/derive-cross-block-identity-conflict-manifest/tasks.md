## 1. Implement cross-block identity validation and queueing

- [ ] 1.1 Add the new read-only manifest CLI consuming frozen identity and partition manifests.
- [ ] 1.2 Hard-fail exact-name and reviewed-alias component leakage across blocks.
- [ ] 1.3 Emit deterministic cross-block near-similar review edges between distinct components with one coordinator and complete endpoints.
- [ ] 1.4 Preserve pending outcomes and layered digests; never approve merge, split, rename, archive, or owner changes.

## 2. Verify the deliverable

- [ ] 2.1 Add exact-fail, alias-fail, near-similar-queue, stale-owner, duplicate-edge, and placeholder synthetic fixtures.
- [ ] 2.2 Add a fixed real-snapshot reconciliation integration test.
- [ ] 2.3 Prove byte-identical repeated runs and no writes.
