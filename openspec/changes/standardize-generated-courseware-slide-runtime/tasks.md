## 1. Shared manifest contract

- [x] 1.1 Extend shared manifest types and schemas with BOPPPS stage/step timing, fixed 16:9 layouts, named slots, size variants, text budgets, and role-safe activity metadata.
- [x] 1.2 Register the finite P0 layout-template and module-size catalog with deterministic occupancy and compatibility rules.
- [x] 1.3 Register the generated content/activity allowlist and six canonical response kinds without dynamic module registration.

## 2. Rendering and compatibility

- [x] 2.1 Implement the fixed 16:9 step canvas and whole-canvas responsive scaling in the shared lesson renderer.
- [x] 2.2 Implement bounded font adaptation, suggested-length warnings, and explicit unfit states without clipping, scrolling, or hidden overflow.
- [x] 2.3 Preserve existing preset lesson rendering and add manifest/renderer regression fixtures for legacy paths.

## 3. Deterministic validation

- [x] 3.1 Implement the pure static validator with stable issue codes for hierarchy, timing, bounds, allowlist, schemas, occupancy, size, text, and role metadata.
- [x] 3.2 Implement pinned-browser, pinned-font, fixed-viewport validation for bounds, overlap, clipping, scroll overflow, formula width, and minimum font size.
- [x] 3.3 Add content-hash invalidation and machine-readable stage/step/module issue locations.
- [x] 3.4 Run schema, registry, renderer, validator, legacy compatibility, typecheck, and strict OpenSpec tests; record AC evidence.

  Evidence: related Vitest 99/99; Playwright 20/20; typecheck, target ESLint, strict OpenSpec validation, and `git diff --check` passed; independent Sol Medium final review approved with no P0/P1/P2 findings.
