## 1. Baseline Evidence

- [ ] 1.1 Re-run `rtk npm run test:react-doctor:ui-errors` and confirm zero diagnostics.
- [ ] 1.2 Re-run `rtk npm run test:react-doctor:owned-errors` and confirm zero selected diagnostics.
- [ ] 1.3 Re-run `rtk npm run test:react-doctor:owned-security` and confirm zero selected diagnostics.
- [ ] 1.4 Re-run `rtk npm run react-doctor:owned-warnings` and save grouped warning evidence.

## 2. Classification

- [ ] 2.1 Classify warning rules into product-risk, mechanical-cleanup, tool-noise, or deferred buckets.
- [ ] 2.2 Document R3F/Three `no-unknown-property` handling separately from real DOM unknown-property findings.
- [ ] 2.3 Produce a stable machine-readable baseline summary by rule, surface, and file.

## 3. Governance Contract

- [ ] 3.1 Update local documentation to explain that warning evidence is advisory unless a child change promotes a rule family.
- [ ] 3.2 Add or update tests for the warning report shape and excluded roots.
- [ ] 3.3 Run `rtk openspec validate govern-react-doctor-warning-baseline --strict`.
