## 1. Baseline Evidence

- [x] 1.1 Re-run `rtk npm run test:react-doctor:ui-errors` and confirm zero diagnostics.
- [x] 1.2 Re-run `rtk npm run test:react-doctor:owned-errors` and confirm zero selected diagnostics.
- [x] 1.3 Re-run `rtk npm run test:react-doctor:owned-security` and confirm zero selected diagnostics.
- [x] 1.4 Re-run `rtk npm run react-doctor:owned-warnings` and save grouped warning evidence.

## 2. Classification

- [x] 2.1 Classify warning rules into product-risk, mechanical-cleanup, tool-noise, or deferred buckets.
- [x] 2.2 Document R3F/Three `no-unknown-property` handling separately from real DOM unknown-property findings.
- [x] 2.3 Produce a stable machine-readable baseline summary by rule, surface, and file.

## 3. Governance Contract

- [x] 3.1 Update local documentation to explain that warning evidence is advisory unless a child change promotes a rule family.
- [x] 3.2 Add or update tests for the warning report shape and excluded roots.
- [x] 3.3 Run `rtk openspec validate govern-react-doctor-warning-baseline --strict`.
