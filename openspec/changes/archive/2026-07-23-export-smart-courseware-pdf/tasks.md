## 1. Slide PDF projection

- [x] 1.1 Build a dedicated student slide projection with fixed 16:9 geometry and exactly one courseware step per page.
- [x] 1.2 Implement reveal-final-state and static activity projections that omit answers and teacher review points and mark interaction as online-only.
- [x] 1.3 Include courseware/plan version identity and the course-level AI-assisted, teacher-reviewed notice without internal audit metadata.

## 2. Export and evidence

- [x] 2.1 Assemble and store PDF output from the slide projection with revision, render-version, content-hash, page-count, and artifact-hash evidence.
- [x] 2.2 Reject export when the bound published revision, page geometry, overflow checks, or artifact evidence is invalid.
- [x] 2.3 Add deterministic PDF tests for geometry, page count/order, labels, answer leakage, overflow failure, revision identity, and rejection of draft, preview-only, or unpublished input.
- [x] 2.4 Run focused export tests, typecheck, and strict OpenSpec validation; record AC evidence.

  Evidence (2026-07-23): `npm run typecheck`; focused PDF projection/service and route Vitest suites; `npm run test:smart-courseware`; `npx openspec validate export-smart-courseware-pdf --strict` all passed.
