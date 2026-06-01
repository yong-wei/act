## 1. Command Scope

- [ ] 1.1 Make lint ignore `evaluate/**/*` and other non-project sample trees without weakening warnings.
- [ ] 1.2 Verify lint still scans `src`, `scripts`, config, and project-owned tests as intended.
- [ ] 1.3 Fix `test:model-render-policy` module resolution from `scripts/tests`.

## 2. Validation

- [ ] 2.1 Run `rtk npm run lint`.
- [ ] 2.2 Run `rtk npm run test:model-render-policy`.
- [ ] 2.3 Validate with `rtk openspec validate stabilize-validation-command-surfaces --strict`.
