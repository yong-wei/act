## Why

The #1117 stage snapshot proves a pinned candidate input but deliberately stops before CourseCoverage acceptance, role Mapping, Teaching Projection, and production activation. A separate, non-blocking follow-up change is required to complete those gates and perform one auditable final cutover without treating the stage snapshot or an old Coverage verdict as authority; #1117 remains a valid read-only snapshot proof while this work proceeds.

## What Changes

- Independently review all 3,609 current CourseCoverage worklist items, including explicit handling of the 1,772 profile-only records; bind every decision to the current worklist digest, Release, Delta, and authoring revision.
- Replace the two invalid approximate mappings with separate contracts for activity/evaluation capability and scene-migration capability; complete nine-role Mapping through independent Primary and Challenger reviews plus Third adjudication when those reviews disagree.
- Produce and attest the formal Teaching Projection and handoff, with one-time conflict resolution against existing KAQ knowledge-to-knowledge relations.
- Cut every formal graph, Konling, RAG, SAR, KAQ, resource, CourseCoverage, path, and Canonical writer consumer over together; no consumer may switch early or retain a mixed authority.
- Rehearse the latest production data with the exact application, schema, ReleaseSet, migration, backup, rollback window, and smoke checks, then execute the approved downtime cutover.
- Materialize the permission-preserving Legacy Archive, retire the old runtime and business readers, and reset Legacy-bound favorites, layouts, and recent-visit state without creating Canonical mappings.
- **BREAKING**: after successful cutover, the Legacy graph is no longer a formal business runtime and the active consumers resolve only through the final Canonical authority.

## Capabilities

### New Capabilities

- `final-knowledge-authority-cutover-and-legacy-archive`: Defines the final teaching projection, all-consumer authority switch, production rehearsal/downtime gate, Legacy Archive, and old-runtime retirement.

### Modified Capabilities

无。Existing capability requirements remain unchanged until this final gate is explicitly accepted; implementation may integrate them through the new cross-capability gate.

## Impact

- Affects the course-coverage review pipeline, role Mapping and capability contracts, Teaching Projection/handoff/attestation records, graph and learning consumers, Canonical writers, production migration runbooks, archive routes, and user preference reset.
- Depends on the #1117 snapshot only as a pinned input; it MUST re-resolve the latest eligible Release before cutover and MUST NOT use a stage snapshot as production proof.
