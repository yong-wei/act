## 1. Define Delta persistence and identities

- [x] 1.1 Define deterministic object, relation, Crosswalk, component, Projection and vocabulary delta records plus `BASELINE` and packaging-revision classifications.
- [x] 1.2 Add the immutable `ReleaseSetDeltaReceipt` and generic candidate/invalidation signal persistence with input/output digests, algorithm version and unique constraints.
- [x] 1.3 Bind every receipt to verified base/candidate Bundle, ReleaseSet, Release, Projection and ACT capture identities.

## 2. Implement ACT-owned difference calculation

- [x] 2.1 Load only completed, round-trip-verified database snapshots and emit a `BASELINE` Delta when no prior accepted ReleaseSet exists.
- [x] 2.2 Implement deterministic object comparison for added, removed, payload, type, tier and supersession changes.
- [x] 2.3 Implement deterministic relation comparison for added, removed, predicate, direction, tier and endpoint changes.
- [x] 2.4 Implement Crosswalk, component, Projection-profile/digest and vocabulary comparisons.
- [x] 2.5 Detect same-ID type or material identity replacement and unsupported in-place relation replacement as fail-closed integrity violations.
- [x] 2.6 Short-circuit semantic expansion for compatible packaging revisions while preserving their Bundle receipt identity.

## 3. Cross-check upstream evidence and emit signals

- [x] 3.1 Parse the supported upstream release-diff Artifact as cross-check evidence without using it as the calculation source.
- [x] 3.2 Reject downstream authorization when any mutually supported upstream and ACT difference disagrees.
- [x] 3.3 Emit stable, deduplicated object/relation/Crosswalk/component/Projection/vocabulary candidate and invalidation signals from accepted semantic Deltas.
- [x] 3.4 Prove signals contain affected identities and reasons but no course role, resource role, teaching relation or selector mutation.

## 4. Verify baseline, updates, and no-op revisions

- [x] 4.1 Add tests for #1125 v0.2-to-standard-candidate comparison, empty-installation baseline, relation-only addition, object payload update, object removal, Crosswalk change, component addition and Projection-profile change.
- [x] 4.2 Add tests for packaging-only revision, repeated/concurrent computation and receipt identity conflict.
- [x] 4.3 Add negative tests for canonical type replacement, missing supersession, endpoint/direction replacement and upstream Diff disagreement.
- [x] 4.4 Run database integration tests proving immutable receipts, stable signals and unchanged candidate/active/Legacy selectors.
- [x] 4.5 Run targeted tests, typecheck, data-governance checks, build and strict OpenSpec validation.
- [x] 4.6 Document the Delta contract consumed by course/resource governance and later consumer migrations.
