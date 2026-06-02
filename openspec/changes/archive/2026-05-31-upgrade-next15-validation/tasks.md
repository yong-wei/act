## 1. Upgrade

- [x] 1.1 Confirm readiness tasks are complete and merged into the migration branch.
- [x] 1.2 Upgrade Next to the selected supported Next 15 version and align peer dependencies.
- [x] 1.3 Apply route, config, lint, cache, and build compatibility changes required by Next 15.

## 2. Validation

- [x] 2.1 Run `rtk npm run build`.
- [x] 2.2 Run `rtk npm run test:unit`.
- [x] 2.3 Run `rtk npm run test`.
- [x] 2.4 Run targeted auth and AI smoke checks if those routes changed behavior.
- [x] 2.5 Run `rtk npm audit --json` and document resolved and remaining findings.
- [x] 2.6 Validate with `rtk openspec validate upgrade-next15-validation --strict`.

## Notes

- `rtk npm run build`: passed on Next `15.5.18`.
- `rtk npm run test`: passed.
- `rtk npm run test:unit`: run completed with 13 existing interactive/data-governance failures; no Next 15-specific failure remains after updating the Arena publication source assertion.
- Targeted auth/AI smoke: no separate auth or AI behavior smoke was required because this change did not intentionally alter auth or AI route behavior; async segment handling is covered by build and route smoke tests.
- `rtk npm audit --json`: 17 remaining vulnerabilities, `10 low / 6 moderate / 1 high`.
- `rtk openspec validate upgrade-next15-validation --strict`: passed before this change was archived. After archive, the repeatable validation commands are `rtk openspec validate dependency-vulnerability-catalog --strict`, `rtk openspec validate --changes --strict`, and `rtk openspec validate --specs --strict`.
