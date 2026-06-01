## Context

Current evidence:

- `npm audit --omit=dev --json` reports moderate findings for `next` via nested `next/node_modules/postcss <8.5.10`.
- `npm audit` suggests `next@9.3.3`, which is an unsafe downgrade path for this app.
- Deprecated install warnings are owned by different lanes:
  - ESLint 8 transitive packages: dev tooling migration.
  - Tailwind 3 `sucrase -> glob@10.5.0`: Tailwind line or transitive tooling.
  - Drei 9 `three-mesh-bvh@0.7.8`: React 18/R3F 8/Drei 9 graphics line; Drei 10 requires React 19 and R3F 9.

## Approach

- Treat `npm audit` findings as real until explicitly allowlisted with owner issue, review date, and removal condition.
- Treat deprecation warnings as owned residual signals, not as security audit findings.
- Keep ownership separate from implementation upgrades so later changes can handle low-risk refreshes and major migrations independently.

## Verification

- `rtk npm audit --omit=dev --json`
- `rtk npm ci` or the clean-install evidence produced by `normalize-runtime-log-and-environment-signals`
- Dependency path checks for ESLint, Tailwind, and Drei warning owners.
- Governance command/report showing each residual has an owner and disposition.
- `rtk openspec validate own-dependency-audit-residual-signals --strict`
