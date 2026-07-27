## 1. Define repository contracts

- [ ] 1.1 Define candidate, active, and legacy authority selectors and versioned Repository result types.
- [ ] 1.2 Implement database-only Repository queries for ReleaseSets, objects, relations, sources, and evidence.
- [ ] 1.3 Add explicit unavailable and drift diagnostics without file or Legacy fallback.

## 2. Implement bounded projections

- [ ] 2.1 Implement `act.canvas.v2` with typed nodes, exact predicates, direction, governance level, and ReleaseSet identity.
- [ ] 2.2 Implement role-aware `act.node-detail.v2` with student, teacher, and administrator field boundaries.
- [ ] 2.3 Implement `act.migration-review.v1` for ingest, Legacy archive readiness, and active-consumer rebinding audit.
- [ ] 2.4 Add projection versioning and cache isolation across authority states.

## 3. Verify authority isolation

- [ ] 3.1 Add tests proving formal consumers cannot resolve candidate data through an active selector.
- [ ] 3.2 Add tests proving missing database data never triggers Release-file reads.
- [ ] 3.3 Verify generic current-Schema-valid types remain read-only until a consumer declares semantic support.
- [ ] 3.4 Run targeted tests, typecheck, and strict OpenSpec validation while preserving the Legacy production authority.
