## 1. Implement relation queue derivation

- [ ] 1.1 Add the new read-only manifest CLI consuming frozen partition and identity-review manifests.
- [ ] 1.2 Preserve raw source IDs while deduplicating versioned typed signatures whose endpoints reference candidate component IDs.
- [ ] 1.3 Emit only `contains`, `prerequisite`, or `association` candidates with one coordinator, complete endpoints, typed items, scope anchors, and layered digests.
- [ ] 1.4 Report snapshot reconciliation and expected/observed drift without hard-coding observed cardinalities.

## 2. Verify the deliverable

- [ ] 2.1 Add synthetic provenance, duplicate-signature, stale-endpoint, unknown-family, missing-owner, and no-approval fixtures.
- [ ] 2.2 Add a fixed real-snapshot integration test.
- [ ] 2.3 Prove byte-identical repeated runs and no writes.
- [ ] 0.1 Exclude historical facts/events, learner-derived state, and inactive references from relation-candidate evidence.
