## 1. Framework Upgrade

- [x] 1.1 Upgrade Next to the selected latest stable Next 16 release and align `eslint-config-next`.
- [x] 1.2 Update Playwright if needed for Next peer compatibility.
- [x] 1.3 Update Next config for Next 16 conventions without changing unrelated behavior.
- [x] 1.4 Audit middleware/proxy impact and record that no root middleware exists if unchanged.
- [x] 1.5 Record audit impact for Next-owned PostCSS findings.

## 2. Compatibility Testing

- [x] 2.1 Run `rtk npx tsc --noEmit --pretty false`.
- [x] 2.2 Run `rtk npm run lint`.
- [x] 2.3 Run `rtk npm run test`.
- [x] 2.4 Run `rtk npm run test:unit`.
- [x] 2.5 Run `rtk npm run build`.
- [x] 2.6 Run browser validation for the agreed route set, including `/data-center` at desktop and mobile widths.
- [x] 2.7 Run integration or Playwright checks when local auth/database prerequisites are available.

## 3. OpenSpec Validation

- [x] 3.1 Run `rtk openspec validate upgrade-next-16-framework-chain --strict`.
