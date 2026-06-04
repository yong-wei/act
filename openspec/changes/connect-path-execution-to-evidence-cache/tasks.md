## 1. Evidence Mapping

- [ ] 1.1 Define governed feature groups for path adoption, completion, deviation, fallback, terminal validation, and intervention outcomes.
- [ ] 1.2 Map path execution, deviation, and intervention records to feature-cache source windows and confidence states.
- [ ] 1.3 Define idempotency keys or dedupe rules for repeated path evidence writes.

## 2. Cache Refresh

- [ ] 2.1 Refresh or enqueue refresh for the affected student's feature cache after path evidence changes.
- [ ] 2.2 Ensure cache rebuild uses owner-user scope and stable ordering.
- [ ] 2.3 Preserve preview-only, low-confidence, stale, and missing-evidence markers.

## 3. Verification

- [ ] 3.1 Add feature-cache rebuild tests for path adoption, completion, deviation, fallback, and intervention outcomes.
- [ ] 3.2 Add tests that repeated writes do not double-count competency contribution or intervention acceptance.
- [ ] 3.3 Add tests that personalization consumers read governed features instead of raw execution tables.
- [ ] 3.4 Run `rtk openspec validate connect-path-execution-to-evidence-cache --strict`.
- [ ] 3.5 Run focused data-governance, feature-cache, and personalization tests.
