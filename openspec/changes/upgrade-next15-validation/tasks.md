## 1. Upgrade

- [ ] 1.1 Confirm readiness tasks are complete and merged into the migration branch.
- [ ] 1.2 Upgrade Next to the selected supported Next 15 version and align peer dependencies.
- [ ] 1.3 Apply route, config, lint, cache, and build compatibility changes required by Next 15.

## 2. Validation

- [ ] 2.1 Run `rtk npm run build`.
- [ ] 2.2 Run `rtk npm run test:unit`.
- [ ] 2.3 Run `rtk npm run test`.
- [ ] 2.4 Run targeted auth and AI smoke checks if those routes changed behavior.
- [ ] 2.5 Run `rtk npm audit --json` and document resolved and remaining findings.
- [ ] 2.6 Validate with `rtk openspec validate upgrade-next15-validation --strict`.
