## 1. Inventory and characterization

- [x] 1.1 Freeze the source revision and enumerate runtime lesson, manifest,
  handout, graph, media, textbook, generated-courseware, and bound-blob
  callers, including tests and scripts.
- [x] 1.2 Record canonical id, runtime directory, release/tree locator,
  source revision, complete digest, resource hashes, identity projection, and
  manifest hash for representative ordinary and session-bound reads.
- [x] 1.3 Characterize missing, malformed, stale, mismatched, optional, and
  authoring-path inputs with the current expected errors/results.

## 2. Canonical CourseBundle read surface

- [x] 2.1 Expose runtime lesson and bound-resource reads from the existing
  `src/lib/course-bundle` public entry without adding a second contract.
- [x] 2.2 Make identity resolution precede runtime path resolution and preserve
  the captured revision/hash envelope on every returned read.
- [x] 2.3 Keep reads server-only and route Classroom access, live state, and
  submission evidence through their existing application contracts.

## 3. Consumer migration and retirement

- [x] 3.1 Migrate route/page/resource consumers and tests from the old runtime
  aggregator to the canonical CourseBundle read surface.
- [x] 3.2 Verify authoring content is never used as a runtime fallback and that
  optional media/knowledge-card failures retain base lesson availability.
- [x] 3.3 Re-run static, dynamic, and bundle-import inventories; remove the old
  runtime authority and duplicate aliases only at zero required callers.

## 4. Verification and handoff

- [x] 4.1 Run focused identity, runtime manifest, media, bound-resource,
  generated-courseware, session-access, and drift tests.
- [x] 4.2 Run affected Interactive/Classroom tests, typecheck, lint, and the
  strict validation for this change; record source revision and hashes.
- [x] 4.3 Publish a migration ledger with behavior comparison, deletion proof,
  rollback boundary, and known non-blocking test gaps.
