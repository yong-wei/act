## 1. Dependency Updates

- [ ] 1.1 Re-run the baseline audit and identify compatible patch/minor fixes.
- [ ] 1.2 Update eligible direct dependencies and lockfile entries without `--force`.
- [ ] 1.3 Leave major-only fixes documented as deferred to their dedicated changes.

## 2. Validation

- [ ] 2.1 Run `rtk npm audit --json` and compare remaining findings.
- [ ] 2.2 Run `rtk npm run test:unit`.
- [ ] 2.3 Run `rtk npm run lint` or record why lint is blocked by the current Next script.
- [ ] 2.4 Validate with `rtk openspec validate upgrade-low-risk-vulnerable-dependencies --strict`.
