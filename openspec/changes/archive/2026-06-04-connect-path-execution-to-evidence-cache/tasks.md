## 1. Evidence Mapping

- [x] 1.1 Define governed feature groups for path adoption, completion, deviation, fallback, terminal validation, and intervention outcomes.
- [x] 1.2 Map path execution, deviation, and intervention records to feature-cache source windows and confidence states.
- [x] 1.3 Define idempotency keys or dedupe rules for repeated path evidence writes.

## 2. Cache Refresh

- [x] 2.1 Refresh or enqueue refresh for the affected student's feature cache after path evidence changes.
- [x] 2.2 Ensure cache rebuild uses owner-user scope and stable ordering.
- [x] 2.3 Preserve preview-only, low-confidence, stale, and missing-evidence markers.

## 3. Verification

- [x] 3.1 Add feature-cache rebuild tests for path adoption, completion, deviation, fallback, and intervention outcomes.
- [x] 3.2 Add tests that repeated writes do not double-count competency contribution or intervention acceptance.
- [x] 3.3 Add tests that personalization consumers read governed features instead of raw execution tables.
- [x] 3.4 Run `rtk openspec validate connect-path-execution-to-evidence-cache --strict`.
- [x] 3.5 Run focused data-governance, feature-cache, and personalization tests.
