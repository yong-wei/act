## 1. Implement the identity manifest

- [x] 1.1 Add the new read-only manifest CLI for exact normalized-name and reviewed-alias identity equivalence components.
- [x] 1.2 Enforce global closure, indivisibility, stable component IDs, absence of pre-partition `owner_block`, and component-internal pending split records.
- [x] 1.3 Emit near-similar review edges only between distinct components and attach only resolved `course-scope-anchor/v1` evidence references without extracting anchors or approving admission.
- [x] 1.4 Bind governance, source snapshot, upstream manifest, algorithm, normalization, and per-source digests with expected/observed drift.

## 2. Verify the deliverable

- [x] 2.1 Add synthetic hard-equivalence closure, forbidden-owner, near-similar queue, pending-split, scope-anchor-evidence, namespace, and history-ambiguity fixtures.
- [ ] 2.2 Add a fixed real-snapshot integration test that reports observed counts as versioned evidence.
- [x] 2.3 Prove input-order independence, byte-identical repeated runs, and no writes.
