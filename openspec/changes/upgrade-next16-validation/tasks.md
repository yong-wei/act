## 1. Preconditions

- [ ] 1.1 Confirm `upgrade-next15-validation` is merged into the migration branch.
- [ ] 1.2 Confirm whether remaining Next-related audit findings require or justify a Next 16 step.

## 2. Upgrade

- [ ] 2.1 If Next 16 is required or justified, upgrade Next to the selected supported Next 16 version and align React/peer dependencies.
- [ ] 2.2 If Next 16 is required or justified, apply required framework compatibility changes.
- [ ] 2.3 If Next 16 is not required, document the evidence, remaining audit state, and reopen trigger.
- [ ] 2.4 Re-check standalone build and deployment assumptions when the upgrade path changes framework output.

## 3. Validation

- [ ] 3.1 Run `rtk npm run build`.
- [ ] 3.2 Run `rtk npm run test:unit`.
- [ ] 3.3 Run `rtk npm run test`.
- [ ] 3.4 Run `rtk npm run test:integration` if route/browser behavior changed materially.
- [ ] 3.5 Run repository image build if standalone output changed.
- [ ] 3.6 Run `rtk npm audit --json` and document remaining findings or the not-required decision evidence.
- [ ] 3.7 Validate with `rtk openspec validate upgrade-next16-validation --strict`.
