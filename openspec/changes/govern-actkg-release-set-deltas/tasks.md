## 1. Define Delta persistence and identities

- [ ] 1.1 Define deterministic object, relation, Crosswalk, component, Projection and vocabulary delta records plus `BASELINE` and packaging-revision classifications.
- [ ] 1.2 Add the immutable `ReleaseSetDeltaReceipt` and generic candidate/invalidation signal persistence with input/output digests, algorithm version and unique constraints.
- [ ] 1.3 Bind every receipt to verified base/candidate Bundle, ReleaseSet, Release, Projection and ACT capture identities.

## 2. Implement ACT-owned difference calculation

- [ ] 2.1 Load only completed, round-trip-verified database snapshots and emit a `BASELINE` Delta when no prior accepted ReleaseSet exists.
- [ ] 2.2 Implement deterministic object comparison for added, removed, payload, type, tier and supersession changes.
- [ ] 2.3 Implement deterministic relation comparison for added, removed, predicate, direction, tier and endpoint changes.
- [ ] 2.4 Implement Crosswalk, component, Projection-profile/digest and vocabulary comparisons.
- [ ] 2.5 Detect same-ID type or material identity replacement and unsupported in-place relation replacement as fail-closed integrity violations.
- [ ] 2.6 Short-circuit semantic expansion for compatible packaging revisions while preserving their Bundle receipt identity.

## 3. Cross-check upstream evidence and emit signals

- [ ] 3.1 Parse the supported upstream release-diff Artifact as cross-check evidence without using it as the calculation source.
- [ ] 3.2 Reject downstream authorization when any mutually supported upstream and ACT difference disagrees.
- [ ] 3.3 Emit stable, deduplicated object/relation/Crosswalk/component/Projection/vocabulary candidate and invalidation signals from accepted semantic Deltas.
- [ ] 3.4 Prove signals contain affected identities and reasons but no course role, resource role, teaching relation or selector mutation.

## 4. Verify baseline, updates, and no-op revisions

- [ ] 4.1 Add tests for #1125 v0.2-to-standard-candidate comparison, empty-installation baseline, relation-only addition, object payload update, object removal, Crosswalk change, component addition and Projection-profile change.
- [ ] 4.2 Add tests for packaging-only revision, repeated/concurrent computation and receipt identity conflict.
- [ ] 4.3 Add negative tests for canonical type replacement, missing supersession, endpoint/direction replacement and upstream Diff disagreement.
- [ ] 4.4 Run database integration tests proving immutable receipts, stable signals and unchanged candidate/active/Legacy selectors.
- [ ] 4.5 Run targeted tests, typecheck, data-governance checks, build and strict OpenSpec validation.
- [ ] 4.6 Document the Delta contract consumed by course/resource governance and later consumer migrations.
