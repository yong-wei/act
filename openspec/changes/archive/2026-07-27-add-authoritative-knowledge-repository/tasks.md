## 1. Define repository contracts

- [x] 1.1 Define candidate, active, and legacy authority selectors and versioned Repository result types.
- [x] 1.2 Implement database-only Repository queries for ReleaseSets, objects, relations, sources, and evidence.
- [x] 1.3 Add explicit unavailable and drift diagnostics without file or Legacy fallback.

## 2. Implement bounded projections

- [x] 2.1 Implement `act.canvas.v2` with typed nodes, exact predicates, direction, governance level, and ReleaseSet identity.
- [x] 2.2 Implement role-aware `act.node-detail.v2` with student, teacher, and administrator field boundaries.
- [x] 2.3 Implement `act.migration-review.v1` for ingest, Legacy archive readiness, and active-consumer rebinding audit.
- [x] 2.4 Add projection versioning and cache isolation across authority states.

## 3. Verify authority isolation

- [x] 3.1 Add tests proving formal consumers cannot resolve candidate data through an active selector.
- [x] 3.2 Add tests proving missing database data never triggers Release-file reads.
- [x] 3.3 Verify generic current-Schema-valid types remain read-only until a consumer declares semantic support.
- [x] 3.4 Run targeted tests, typecheck, and strict OpenSpec validation while preserving the Legacy production authority.
