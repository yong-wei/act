## 1. Implement the domain candidate manifest

- [ ] 1.1 Add the new read-only manifest CLI for flat domain candidates and dimension-pollution review records.
- [ ] 1.2 Preserve the versioned seed set only as evidence; do not fix final domain cardinality.
- [ ] 1.3 Classify semantic-domain, course/module, navigation/topic-filter, and invalid/unknown dimensions without concept assignment.
- [ ] 1.4 Emit versioned normalization, source, upstream, contract, and drift metadata.

## 2. Verify the deliverable

- [ ] 2.1 Add synthetic uniqueness, flatness, pollution, seed-drift, forbidden-membership, and forbidden-owner fixtures.
- [ ] 2.2 Add a fixed real-snapshot integration test and observed-label reconciliation.
- [ ] 2.3 Prove byte-identical repeated runs and no writes.
- [ ] 0.1 Reject historical facts/events, learner-derived state, and inactive legacy references as domain-candidate evidence.
