## 1. Extend candidate persistence without rewriting #1125

- [x] 1.1 Add Bundle Receipt, Artifact role/profile/contract, component-reference and multi-Projection persistence fields plus uniqueness constraints that allow #1125 historical fields to remain explicitly unavailable.
- [x] 1.2 Add a migration/readiness test proving all existing v0.2 rows, receipts, raw Artifacts and Repository results remain byte- and identity-stable.
- [x] 1.3 Define the persistence input boundary for `ValidatedActKGBundle` without importing validator file-discovery or Manifest parsing into the database layer.

## 2. Implement transactional standard Bundle import

- [x] 2.1 Stage Bundle, Artifact, Release, component, Projection, runtime object/relation, Link Metadata, Crosswalk and statistic records in one transaction.
- [x] 2.2 Implement semantic Release reuse for compatible packaging revisions and fail-closed conflicts for reused Bundle, Release or Artifact identities with different digests.
- [x] 2.3 Reconstruct every public Artifact and runtime semantic collection from staged data and compare bytes, identities, digests and counts before writing `ACCEPTED_CANDIDATE`.
- [x] 2.4 Make identical and concurrent imports idempotent and prove every Stage or Round Trip failure leaves no partial rows.
- [x] 2.5 Keep accepted standard ReleaseSets addressable only by explicit identity and prove import does not move default candidate, active or Legacy selectors.

## 3. Read standard candidates through the existing Repository

- [x] 3.1 Split Repository diagnosis between the frozen #1125 exact contract and persisted standard Bundle/Schema/Artifact-contract identities.
- [x] 3.2 Map the validated runtime Projection to existing `act.canvas.v2`, `act.node-detail.v2` and `act.migration-review.v1` contracts while preserving separate domain/review Projection records.
- [x] 3.3 Bind queries, responses, caches and diagnostics to ReleaseSet, Release, runtime profile and digest and reject mixed or receipt-incomplete snapshots.
- [x] 3.4 Add tests for different valid counts, registered and unregistered types/predicates, explicit historical reads, missing receipts and no file/Legacy fallback.

## 4. Verify migration and candidate isolation

- [x] 4.1 Run local database migration and import the v0.3 packaging fixture plus a synthetic v0.4 semantic update through the compatibility output.
- [x] 4.2 Verify raw Artifact round trips, packaging-only reuse, multi-Projection persistence, Repository candidate reads, rollback and concurrent idempotency.
- [x] 4.3 Run targeted ingestion/Repository/projection tests, migration readiness, typecheck, affected data-governance checks, build and strict OpenSpec validation.
- [x] 4.4 Document the unchanged #1125 exact path, explicit-candidate boundary, downstream Delta handoff and unchanged production authority.
