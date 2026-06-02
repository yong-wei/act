## Framework Migration Notes

Next 16 introduces or emphasizes:

- Turbopack default behavior and top-level `turbopack` config.
- Middleware-to-proxy naming and type changes when middleware exists.
- Continued support for React 18.2+ and React 19 peer ranges.
- Playwright peer requirement of at least `^1.51.1`.
- Potential generated type and route behavior changes.

## Repository-Specific Checks

The repository currently has:

- `next.config.js` with `output: 'standalone'`; no `experimental.turbopack`,
  `webpack`, `headers`, or `rewrites` configuration was present, so no
  Next-config behavior change was needed.
- App Router routes under `src/app`.
- No root or `src/` `middleware.ts`/`middleware.js`/`proxy.ts`/`proxy.js`
  was detected in the current worktree, so the Next 16 middleware-to-proxy
  migration has no file to rename in this lane.
- Docker standalone output copied into the runner image.

## Package And Lint Decisions

- Selected current stable `next@16.2.7` and aligned
  `eslint-config-next@16.2.7`.
- Kept React at `18.3.1`; `next@16.2.7` peer dependencies allow
  `^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0`, so React 19 remains
  deferred to its own lane.
- Kept `@playwright/test@1.60.0`; it already satisfies the Next peer
  requirement `^1.51.1`.
- Migrated `.eslintrc.json` to `eslint.config.mjs` for ESLint 9 flat config.
  React Compiler lint rules introduced through `eslint-plugin-react-hooks@7`
  are disabled in this lane because React Compiler/React 19 code rewrites are
  explicitly out of scope.
- Treated root `next-env.d.ts` as a Next-generated file per current Next
  documentation and moved stable Next/Image global type references into
  `types/next-env.d.ts`. `tsconfig.json` includes both production and dev
  generated route type folders so `next build`, `next dev`, and direct
  `tsc --noEmit` do not fight over a tracked generated file.

## Audit And Build Findings

- `rtk npm audit --json` still reports two moderate findings under
  `next -> postcss`; the affected node is Next's nested
  `node_modules/next/node_modules/postcss`, and npm still suggests an invalid
  semver-major downgrade to `next@9.3.3`. This remains a Next-owned residual
  after upgrading to `next@16.2.7`.
- `rtk npm run build` completed with Next.js 16.2.7 and Turbopack, including
  `output: 'standalone'` route output. The build emitted 11 Turbopack/NFT
  warnings for dynamic `path.join(process.cwd(), ...)` file tracing in
  course-runtime and MDX content paths; those are performance/trace warnings
  rather than build blockers and should be handled in a separate runtime
  tracing refinement if needed.

## Browser Route Set

Minimum browser validation should include:

- `/`
- `/login?callbackUrl=%2Fdata-center`
- `/data-center`
- `/interactive-learning`
- `/interactive-learning/courses`
- `/teacher`
- `/admin`
- `/simulations`

Authenticated routes may require seeded/local test accounts.

## Validation Findings

- Browser validation with the fixed local admin account confirmed
  `/data-center` at 1440x900 and 390x844 after login. Both viewports rendered
  the data-center page with `scrollWidth == clientWidth`, five positive
  Recharts container sizes, and no Recharts or console error output after
  setting explicit positive `initialDimension` values for percentage-based
  charts.
- Full `rtk npm run test:integration` now passes the database precheck and
  Playwright suite with 11 passing tests and 8 explicitly skipped 3D
  simulation tests. The skipped tests cover the known React Three Fiber 8 /
  Next 16 dev runtime incompatibility and are assigned to the
  `upgrade-3d-visualization-stack` lane. The integration command still emits
  non-failing Node/NO_COLOR warnings and an existing ECharts `GraphicComponent`
  import warning.
- After PR review, 3D simulation Playwright specs were explicitly skipped with
  a React/Three upgrade-lane reason so the standard integration command no
  longer keeps executing the known R3F 8 / Next 16 dev runtime failure. The
  `/simulations` route remains in browser route validation and production
  builds continue to compile it; release promotion must restore 3D simulation
  smoke coverage in `upgrade-3d-visualization-stack` or pass an equivalent
  production runtime smoke before exposing the migrated stack as production
  complete.
