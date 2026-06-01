## Context

Observed `tsc` failure clusters:

- Next App Router page/route tests pass plain params objects where current signatures expect promise-shaped params.
- Arena and control-workbench fixtures miss required fields such as `training` or `designFlow`.
- Adaptive assessment mocks do not satisfy generic `$transaction` typing.
- Teacher auth and Konling fixtures use stale JWT/page/knowledge type shapes.
- Data-governance tests contain stale JSON and nullable field assumptions.
- `tsconfig.json` still targets `es5` with `es6` libs while project tests use modern APIs such as `Object.hasOwn` and iterators.

## Approach

- Classify each TypeScript error as stale fixture, stale assertion helper, source contract gap, or compiler target/lib mismatch.
- Prefer explicit test builders over broad casts.
- Update compiler target/lib only if it reflects actual supported runtime and does not hide source defects.
- Leave Vitest runtime assertion failures to the unit-contract change unless TypeScript repair requires a shared fixture update.

## Verification

- `rtk npx tsc --noEmit --pretty false`
- Targeted `rtk npm run test:unit -- <affected test>` only when source helpers are changed and a targeted form is available.
- `rtk openspec validate restore-typecheck-contract-signal --strict`
