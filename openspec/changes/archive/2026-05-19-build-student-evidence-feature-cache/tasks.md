## 1. Cache Contract

- [x] 1.1 Define the storage shape for per-student evidence features.
- [x] 1.2 Include evidence windows, source counts, source coverage, freshness timestamps, confidence markers, and feature payload version.
- [x] 1.3 Define read service boundaries for profile, recommendation, and teacher-insight consumers.
- [x] 1.4 Define raw-read exceptions for audit, debug, and drilldown paths.

## 2. Refresh And Rebuild

- [x] 2.1 Build deterministic full-rebuild logic from governed facts and approved aggregates.
- [x] 2.2 Build per-student refresh logic for recently changed evidence.
- [x] 2.3 Track stale, partial, low-confidence, and missing-source states.
- [x] 2.4 Ensure repeated rebuilds produce stable payloads for unchanged source evidence.

## 3. Reporting And Verification

- [x] 3.1 Expose or document cache freshness, source coverage, and rebuild counts for admin governance review.
- [x] 3.2 Add focused tests for cache payload generation, deterministic rebuild, per-student refresh, stale markers, and read-service boundaries.
- [x] 3.3 Run targeted data-governance tests, `npm run lint`, `npm run test`, and `openspec validate build-student-evidence-feature-cache --strict`.
- [x] 3.4 Phase acceptance: profile and recommendation code has a stable feature read model available, but visible personalization behavior is unchanged.
