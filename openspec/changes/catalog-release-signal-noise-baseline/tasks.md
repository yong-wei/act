## 1. Noise Catalog

- [ ] 1.1 Record the branch, commit, and command evidence for the current noise set.
- [ ] 1.2 Classify lint, typecheck, test, unit, model-render-policy, runtime log, dependency audit, deprecated-package, extraneous-package, Browserslist, and Node-version signals.
- [ ] 1.3 Map each signal to a follow-up change in this series.
- [ ] 1.4 Identify which signals are real blockers rather than noise.

## 2. Validation

- [ ] 2.1 Validate with `rtk openspec validate catalog-release-signal-noise-baseline --strict`.
- [ ] 2.2 Confirm no application code, package version, lockfile, or log mutation is included.
