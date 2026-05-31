## 1. Preconditions

- [x] 1.1 Confirm `upgrade-next15-validation` is merged into the migration branch.
- [x] 1.2 Confirm whether remaining Next-related audit findings require or justify a Next 16 step.

## 2. Upgrade

- [x] 2.1 If Next 16 is required or justified, upgrade Next to the selected supported Next 16 version and align React/peer dependencies.
- [x] 2.2 If Next 16 is required or justified, apply required framework compatibility changes.
- [x] 2.3 If Next 16 is not required, document the evidence, remaining audit state, and reopen trigger.
- [x] 2.4 Re-check standalone build and deployment assumptions when the upgrade path changes framework output.

## 3. Validation

- [x] 3.1 Run `rtk npm run build`.
- [x] 3.2 Run `rtk npm run test:unit`.
- [x] 3.3 Run `rtk npm run test`.
- [x] 3.4 Run `rtk npm run test:integration` if route/browser behavior changed materially.
- [x] 3.5 Run repository image build if standalone output changed.
- [x] 3.6 Run `rtk npm audit --json` and document remaining findings or the not-required decision evidence.
- [x] 3.7 Validate with `rtk openspec validate upgrade-next16-validation --strict`.

## Evidence Notes

- `upgrade-next15-validation` is already archived in `openspec/changes/archive/2026-05-31-upgrade-next15-validation/` and merged into `migration/audit-vulnerabilities`.
- `rtk npm audit --json` reports only 2 remaining moderate vulnerabilities: `next` and bundled `postcss` under `next/node_modules/postcss`.
- The remaining `next` audit range is `9.3.4-canary.0 - 16.3.0-canary.5`; stable `next@16.2.6` is still inside the range.
- `rtk npm view next@16.2.6 version peerDependencies dependencies.postcss --json` reports bundled `postcss: 8.4.31`, below the advisory fixed range `>=8.5.10`.
- Next 16 is not required in this migration series because it does not remediate the remaining bundled PostCSS advisory.
- No framework package, React peer, route, middleware/proxy, image, standalone, or deployment-output change was made, so `test:integration` and repository image build were not required for this not-required decision.
- `rtk npm run build`: passed on `next@15.5.18`.
- `rtk npm run test`: passed smoke, Arena home entry, Arena routes, and commercial UI governance checks.
- `rtk npm run test:unit`: completed with 13 existing failures in interactive manifest runtime/taxonomy, lesson entry knowledge map ordering, Next dynamic guard for intervention route, and data-governance fixture expectations. These are the same existing drift areas recorded during prior migration validation and are not caused by #244 because #244 changes only decision documentation and OpenSpec task records.
- `rtk openspec validate upgrade-next16-validation --strict`: passed before this task record was finalized.
