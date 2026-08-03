## Series Dependencies

- Depends on: `activate-versioned-actkg-engineering-authority`, `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`.

## 1. Layered payload and resolver

- [x] 1.1 Extend graph payload schemas with Engineering Authority, ACT prerequisite, and teaching resource layers plus identities/statuses.
- [x] 1.2 Implement scope-aware Teaching Projection resolver and explicit Legacy/pinned fallback adapter.
- [x] 1.3 Add tests for absent/invalid layers, identity drift, no-mixing, and unprojected nodes.

## 2. Graph workspace

- [x] 2.1 Add layer filters/inspector sections without changing existing engineering predicate rendering.
- [x] 2.2 Show scoped resource roles, prerequisite direction/strength, optional-card status, and fallback provenance.
- [x] 2.3 Add UI tests for engineering-only, teaching-only, mixed, and unavailable projection states.

## 3. Course and classroom consumers

- [x] 3.1 Wire course lesson/step scope to Teaching Projection resource resolution.
- [x] 3.2 Implement `step -> canonicalId -> optional card` drawer lookup with node-summary/other-resource fallback.
- [x] 3.3 Verify resources launch through existing registry/routes and no student-facing implementation details leak.

## 4. Verification

- [x] 4.1 Run focused graph payload, resolver, workspace, course runtime, and drawer tests.
- [x] 4.2 Run `rtk openspec validate adopt-layered-graph-and-course-consumers --type change --strict` and `rtk openspec validate --changes --strict`.
