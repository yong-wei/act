## 1. Validate exact future-child records

- [ ] 1.1 Implement validation for the discriminated schema, typed exact items, counts, owners, endpoint blocks, change-ID dependencies, acceptance profiles, scope anchors, and digest layers.
- [ ] 1.2 Validate unique ownership, endpoint coverage, dependency closure/acyclicity, and upstream digest freshness across all preparation manifests.
- [ ] 1.3 Reject placeholders, wildcards, count-only queues, waivers, out-of-scope historical datasets, and stale closure after an accepted split; do not generate or validate a historical catalog.

## 2. Validate bounded cutover readiness

- [ ] 2.1 Require exact inputs for new projection import, reviewed active legacy mappings, active-reference migration, and legacy revision/snapshot compatibility.
- [ ] 2.2 Require post-cutover new facts to bind atomically to the single active new graph revision.
- [ ] 2.3 Exclude historical fact backfill, event replay/deduplication, learner-state reconciliation, full-history decoder closure, and full-root writer equality.

## 3. Verify the validator

- [ ] 3.1 Add synthetic positive and negative fixtures for every schema, topology, digest, split invalidation, bounded cutover, and out-of-scope gate.
- [ ] 3.2 Validate the frozen stage-one snapshot, byte-identical repeated runs, and no writes.
