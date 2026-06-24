# Stable Dependency Migration Baseline - 2026-06-02

Branch: `stabilize-dependency-migration-baseline`
Base branch: `migration/audit-vulnerabilities`
Baseline commit: `f1e204a24decfa383a62c4ba87cf81b46db6f735`
Issue: #272 `Stabilize dependency migration baseline`

This baseline records the current dependency state before latest-stable
development and production dependency migration work. It does not change package
versions, lockfiles, application code, Docker runtime behavior, or tests.

## Runtime And Package Metadata

Commands:

- `rtk proxy node -v`
- `rtk proxy npm -v`
- `rtk proxy npm config get package-lock`
- `rtk proxy npm config get save-exact`
- `rtk shasum -a 256 package-lock.json package.json`

Results:

- Node: `v26.0.0`
- npm: `11.12.1`
- `package.json` engines: Node `^20.19.0 || >=22.12.0 <27`, npm `>=10 <12`
- `packageManager`: `npm@11.12.1`
- npm `package-lock`: `true`
- npm `save-exact`: `false`
- Direct dependency count: 57 production dependencies, 10 dev dependencies
- `package-lock.json` SHA-256:
  `bbe1d5b4a982dd543c95d6edf92e01f8f4b78e9e96caff855caab8009a22d478`
- `package.json` SHA-256:
  `dbb841044e301055bef0a1cb2b9a04b0ba1af75edaab2e1d87183dd740973a4e`

## Outdated Direct Dependency Lanes

Command: `rtk npm outdated --long --json`

The command exits non-zero because outdated packages exist; its JSON output was
used as the baseline fact source.

### Low-risk stable package refresh

- `@ai-sdk/react`: `3.0.195` -> wanted `3.0.196`, latest `3.0.196`
- `@playwright/test`: `1.57.0` -> wanted/latest `1.60.0`
- `@radix-ui/react-slider`: `1.3.5` -> wanted/latest `1.3.6`
- `@radix-ui/react-slot`: `1.2.3` -> wanted/latest `1.2.4`
- `@radix-ui/react-tabs`: `1.1.12` -> wanted/latest `1.1.13`
- `@types/katex`: `0.16.7` -> wanted/latest `0.16.8`
- `@vitest/coverage-v8`: `4.1.7` -> wanted/latest `4.1.8`
- `@xyflow/react`: `12.10.0` -> wanted/latest `12.11.0`
- `ai`: `6.0.193` -> wanted/latest `6.0.194`
- `bullmq`: `5.77.6` -> wanted/latest `5.78.0`
- `echarts`: `6.0.0` -> wanted/latest `6.1.0`
- `katex`: `0.16.27` -> wanted `0.16.47`, latest `0.17.0`
- `recharts`: `3.6.0` -> wanted/latest `3.8.1`
- `sharp`: `0.33.5` -> wanted `0.33.5`, latest `0.34.5`
- `vitest`: `4.1.7` -> wanted/latest `4.1.8`
- `zustand`: `5.0.9` -> wanted/latest `5.0.14`

Owner change: `refresh-low-risk-stable-packages`.

### Next framework chain

- `next`: `15.5.18` -> wanted `15.5.19`, latest `16.2.7`
- `eslint-config-next`: `15.5.18` -> wanted `15.5.19`, latest `16.2.7`

Owner change: `upgrade-next-16-framework-chain`.

### React UI runtime

- `react`: `18.3.1` -> latest `19.2.7`
- `react-dom`: `18.3.1` -> latest `19.2.7`
- `@types/react`: `18.3.23` -> wanted `18.3.30`, latest `19.2.16`
- `@types/react-dom`: `18.3.7` -> latest `19.2.3`
- `lucide-react`: `0.263.1` -> latest `1.17.0`

Owner change: `upgrade-react-19-ui-runtime`.

### Prisma runtime

- `prisma`: `5.22.0` -> latest `7.8.0`
- `@prisma/client`: `5.22.0` -> latest `7.8.0`

Owner change: `upgrade-prisma-7-runtime`.

### Tailwind design system

- `tailwindcss`: `3.4.19` -> latest `4.3.0`
- `tailwind-merge`: `1.14.0` -> latest `3.6.0`
- `autoprefixer`: `10.4.21` -> wanted/latest `10.5.0`

Owner change: `upgrade-tailwind-4-design-system`.

### 3D visualization stack

- `@react-three/fiber`: `8.18.0` -> latest `9.6.1`
- `@react-three/drei`: `9.122.0` -> latest `10.7.7`
- `three`: `0.165.0` -> latest `0.184.0`
- `react-force-graph-2d`: `1.29.0` -> wanted/latest `1.29.1`
- `react-force-graph-3d`: `1.29.0` -> wanted/latest `1.29.1`

Owner change: `upgrade-3d-visualization-stack`.

### Deferred governance/toolchain majors

- `eslint`: `8.57.1` -> latest `10.4.1`
- `typescript`: `5.8.3` -> wanted `5.9.3`, latest `6.0.3`
- `@types/node`: `20.19.4` -> wanted `20.19.41`, latest `25.9.1`

Owner: follow-up governance/toolchain change, or explicit decision to keep the
current major line after the main runtime migration stabilizes.

### Deferred validation/security runtime majors

- `zod`: `3.25.76` -> latest `4.4.3`
- `bcryptjs`: `2.4.3` -> latest `3.0.3`

Owner: follow-up validation/security runtime change, or explicit decision to
keep the current major line after application validation coverage is ready.

## Audit Baseline

Command: `rtk npm audit --json`

Result:

- Total vulnerabilities: 2
- Severity: 2 moderate, 0 high, 0 critical
- Direct finding: `next`
- Transitive finding: `postcss` under `node_modules/next/node_modules/postcss`
- Advisory: `GHSA-qx2v-qp2m-jg93`, PostCSS XSS via unescaped `</style>` in CSS stringify output
- npm suggested fix: `next@9.3.3`, marked semver-major and invalid for this migration baseline

Classification:

- The root residual is Next-owned because the vulnerable `postcss@8.4.31` is
  nested under `next@15.5.18`.
- The root project also has direct `postcss@8.5.15`, which is outside the
  vulnerable range and is pulled by Tailwind, autoprefixer, and Vite/Vitest.
- Do not run `npm audit fix --force`; it proposes an unsafe framework downgrade
  rather than the serialized latest-stable lane.

Owner change: `upgrade-next-16-framework-chain`.

## Production And Development Dependency Boundaries

Commands:

- `rtk npm ls --depth=0 --omit=dev --json`
- `rtk npm ls --depth=0 --include=dev --json`
- `rtk npm explain postcss`
- `rtk npm explain tsx`

Observed local install state:

- Production tree reports three extraneous native packages:
  `@emnapi/core@1.10.0`, `@emnapi/runtime@1.10.0`, and
  `@emnapi/wasi-threads@1.2.1`.
- The same extraneous packages appear in the full dev tree.
- `postcss@8.4.31` is nested below `next@15.5.18`.
- Direct `postcss@8.5.15` is used by `autoprefixer`, Tailwind's PostCSS
  packages, and `vite@8.0.14` through Vitest.
- `tsx@4.22.4` is a dev dependency and also an optional peer of Vite.

Docker and local runtime boundaries:

- `Dockerfile` runs `npm ci --prefer-offline` in the builder stage.
- The runtime image copies `.next/standalone`, Prisma schema/migrations, Prisma
  packages, worker scripts, selected `src` runtime helpers, and public assets.
- `docker-entrypoint.sh` runs `node ./node_modules/prisma/build/index.js migrate deploy`
  only when `DATABASE_URL` is set.
- `scripts/ops/start.sh` currently installs dependencies with `npm install`
  when local dependencies are missing, starts PostgreSQL 18-compatible tooling,
  then starts scheduler, worker, and Next dev server.
- `worker:dev` runs `npx tsx scripts/workers/data-governance-worker.ts`.
- `worker:scheduler` runs `npx tsx scripts/workers/scheduler.ts`.

Owner change for boundary cleanup: `separate-production-runtime-dependencies`.

## Series Order

1. `stabilize-dependency-migration-baseline`
2. `separate-production-runtime-dependencies`
3. `refresh-low-risk-stable-packages`
4. `upgrade-next-16-framework-chain`
5. `upgrade-react-19-ui-runtime`
6. `upgrade-prisma-7-runtime`
7. `upgrade-tailwind-4-design-system`
8. `upgrade-3d-visualization-stack`

This order keeps package-manager and production runtime behavior explicit before
framework, database, design-system, and visualization changes.

## Compatibility Test Matrix

Baseline and low-risk lanes:

- `rtk npx tsc --noEmit --pretty false`
- `rtk npm run test`
- `rtk npm run test:unit`
- `rtk npm audit --json`
- `rtk npm run audit:governance`

Production/runtime lanes:

- `rtk npm run test:docker-migration-readiness`
- `rtk npm run build`
- Docker or Podman build/start smoke when Docker runtime behavior changes
- `rtk npm run worker:dev` and `rtk npm run worker:scheduler` smoke where worker runtime changes

Framework/UI lanes:

- `rtk npm run lint`
- `rtk npm run build`
- `rtk npm run test:commercial-ui-governance`
- Playwright/browser validation for representative authenticated and unauthenticated routes

Database lanes:

- `rtk npx prisma generate`
- `rtk npx prisma migrate deploy --schema ./prisma/schema.prisma` against a disposable database
- `rtk npm run test:data-governance`
- `rtk npm run db:session-data-quality`
- `rtk npm run db:evidence-source-coverage`

3D visualization lanes:

- `rtk npm run wasm:build:control-engine`
- Browser canvas checks for simulation routes
- Desktop and mobile viewport screenshots for affected pages

## Browser And Canvas Route Set

Browser validation should cover:

- `/`
- `/login?callbackUrl=%2Fdata-center`
- `/data-center`
- `/interactive-learning`
- `/interactive-learning/courses`
- `/teacher`
- `/admin`
- `/simulations`
- at least one interactive student route
- at least one 3D simulation route, such as `/simulations/cruise` or `/simulations/container`

Use both desktop and mobile widths for Tailwind, React, and 3D visualization
changes. Canvas checks are required for simulation package changes.

## Baseline Validation

Commands to run in this change:

- `rtk openspec validate stable-dependency-chain-migration --strict`
- `rtk openspec validate --changes --strict`
- `rtk proxy git diff --cached --check`
- `rtk git diff --cached --name-only`

Expected mutation boundary:

- This document
- `openspec/changes/archive/2026-06-02-stabilize-dependency-migration-baseline/`
- `openspec/specs/stable-dependency-chain-migration/spec.md`

Package versions, lockfiles, application code, Docker runtime behavior, and
tests must remain unchanged in this baseline change.
