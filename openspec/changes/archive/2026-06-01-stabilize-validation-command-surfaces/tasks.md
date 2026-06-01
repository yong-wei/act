## 1. Command Scope

- [x] 1.1 Make lint ignore `evaluate/**/*` and other non-project sample trees without weakening warnings.
- [x] 1.2 Verify lint still scans `src`, `scripts`, config, and project-owned tests as intended.
- [x] 1.3 Fix `test:model-render-policy` module resolution from `scripts/tests`.

## 2. Validation

- [x] 2.1 Run `rtk npm run lint`.
- [x] 2.2 Run `rtk npm run test:model-render-policy`.
- [x] 2.3 Validate with `rtk openspec validate stabilize-validation-command-surfaces --strict`.
