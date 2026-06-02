## 1. Dependency Updates

- [x] 1.1 Re-run the baseline audit and identify compatible patch/minor fixes.
- [x] 1.2 Update eligible direct dependencies and lockfile entries without `--force`.
- [x] 1.3 Leave major-only fixes documented as deferred to their dedicated changes.

## 2. Validation

- [x] 2.1 Run `rtk npm audit --json` and compare remaining findings.
- [x] 2.2 Run `rtk npm run test:unit` (executed after `rtk npm run wasm:build:control-engine`; still fails on existing interactive/data-governance assertions unrelated to dependency files).
- [x] 2.3 Run `rtk npm run lint` or record why lint is blocked by the current Next script.
- [x] 2.4 Validate with `rtk openspec validate upgrade-low-risk-vulnerable-dependencies --strict`.
