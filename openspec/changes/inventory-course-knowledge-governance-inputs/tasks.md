## 1. Implement the bounded inventory

- [ ] 1.1 Implement the read-only inventory for current formal-course/reviewed-anchor, current authoring, current published graph/binding, active-reference, and reviewed active legacy-mapping inputs.
- [ ] 1.2 Classify course, resource, progress, note, and path references as active only when current business behavior still reads or continues them; exclude completed paths and historical events.
- [ ] 1.3 Emit deterministic typed records, source/snapshot digests, missing-input findings, and expected/observed drift for readiness inputs.
- [ ] 1.4 Reject historical facts/events, derived learner state, lineage, decoder coverage, evidence deduplication, and full-root writer discovery as out-of-scope inputs without generating a diagnostic catalog.

## 2. Verify the revised contract

- [ ] 2.1 Add synthetic fixtures covering all authoritative classes, reviewed mapping, legacy snapshot compatibility, namespace collisions, missing inputs, and out-of-scope input rejection; prove nested prerequisite/readiness/pathOptions/policyBundle legacy IDs are inventoried for admitted incomplete paths while identical payloads on completed paths are wholly excluded, without adding historical trajectory fixtures.
- [ ] 2.2 Add a fixed current-repository and active-reference snapshot test with proof metadata and no historical learner-data export requirement.
- [ ] 2.3 Prove input-order independence, byte-identical repeated runs, and no writes to repository, database, Git, or GitHub.
