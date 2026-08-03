## 1. Define compositional query contracts

- [x] 1.1 Define SAR source adapters for Repository, KAQ, resource, path, and learner-state Overlay boundaries.
- [x] 1.2 Define aggregate-versioned cross-namespace bindings, explicitly supported semantics, hop limits, candidate budgets, and scope.
- [x] 1.3 Include namespace, authority owner, source identity, and ReleaseSet/Release or Overlay version on every result item.

## 2. Implement query-time composition

- [x] 2.1 Query independent sources in parallel from an explicit seed and scope.
- [x] 2.2 Traverse only reviewed Canonical bindings and supported edge types.
- [x] 2.3 Build a reconstructable candidate projection without persisting mixed graph nodes or relations.
- [x] 2.4 Add version-complete cache keys and source-change invalidation.
- [x] 2.5 Exclude stored but unsupported object types and predicates from semantic traversal.

## 3. Verify authority preservation

- [x] 3.1 Add tests for missing bindings, similar names, version mismatch, bounded expansion, and no-source-mutation.
- [x] 3.2 Add integration tests combining real Repository, KAQ, resource, path, and learner-state fixtures.
- [x] 3.3 Add a SAR authority selector that remains Legacy before final cutover and records Canonical results only as shadow evidence.
- [x] 3.4 Add negative tests proving Canonical pipeline readiness cannot locally replace production SAR.
- [x] 3.5 Run performance checks, targeted tests, typecheck, and strict OpenSpec validation.
