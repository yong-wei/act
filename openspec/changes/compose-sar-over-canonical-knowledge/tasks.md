## 1. Define compositional query contracts

- [ ] 1.1 Define SAR source adapters for Repository, KAQ, resource, path, and learner-state Overlay boundaries.
- [ ] 1.2 Define aggregate-versioned cross-namespace bindings, explicitly supported semantics, hop limits, candidate budgets, and scope.
- [ ] 1.3 Include namespace, authority owner, source identity, and ReleaseSet/Release or Overlay version on every result item.

## 2. Implement query-time composition

- [ ] 2.1 Query independent sources in parallel from an explicit seed and scope.
- [ ] 2.2 Traverse only reviewed Canonical bindings and supported edge types.
- [ ] 2.3 Build a reconstructable candidate projection without persisting mixed graph nodes or relations.
- [ ] 2.4 Add version-complete cache keys and source-change invalidation.
- [ ] 2.5 Exclude stored but unsupported object types and predicates from semantic traversal.

## 3. Verify authority preservation

- [ ] 3.1 Add tests for missing bindings, similar names, version mismatch, bounded expansion, and no-source-mutation.
- [ ] 3.2 Add integration tests combining real Repository, KAQ, resource, path, and learner-state fixtures.
- [ ] 3.3 Add a SAR authority selector that remains Legacy before final cutover and records Canonical results only as shadow evidence.
- [ ] 3.4 Add negative tests proving Canonical pipeline readiness cannot locally replace production SAR.
- [ ] 3.5 Run performance checks, targeted tests, typecheck, and strict OpenSpec validation.
