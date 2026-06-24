## 1. Package Refresh

- [x] 1.1 Select low-risk packages from `npm outdated --long --json`.
- [x] 1.2 Upgrade selected packages without pulling excluded major migration lanes.
- [x] 1.3 Review lockfile changes for unexpected major upgrades, duplicate packages, or new audit findings.

## 2. Validation

- [x] 2.1 Run `rtk npm audit --json` and record resolved and remaining findings.
- [x] 2.2 Run `rtk npx tsc --noEmit --pretty false`.
- [x] 2.3 Run `rtk npm run test`.
- [x] 2.4 Run `rtk npm run test:unit`.
- [x] 2.5 Run targeted browser validation for touched UI/chart/graph surfaces if any runtime UI package changes.
- [x] 2.6 Record deferred latest-stable major lanes and their owner changes for ESLint 10, TypeScript 6, `@types/node` 25, Zod 4, bcryptjs 3, `lucide-react` 1, and `tailwind-merge` 3.

## 3. OpenSpec Validation

- [x] 3.1 Run `rtk openspec validate refresh-low-risk-stable-packages --strict`.

## Evidence

- Selected direct dependency updates:
  - `@ai-sdk/react` 3.0.195 -> 3.0.196: patch.
  - `ai` 6.0.193 -> 6.0.194: patch.
  - `@radix-ui/react-slider` 1.3.5 -> 1.3.6: resolved patch; direct manifest range aligned to current major/minor line.
  - `@radix-ui/react-slot` 1.2.3 -> 1.2.4: resolved patch; direct manifest range aligned to current major/minor line.
  - `@radix-ui/react-tabs` 1.1.12 -> 1.1.13: resolved patch; direct manifest range aligned to current major/minor line.
  - `bullmq` 5.77.6 -> 5.78.0: minor.
  - `echarts` 6.0.0 -> 6.1.0: minor.
  - `recharts` 3.6.0 -> 3.8.1: minor.
  - `zustand` 5.0.9 -> 5.0.14: patch.
  - `katex` 0.16.27 -> 0.16.47: patch on the current 0.16 line.
  - `@xyflow/react` 12.10.0 -> 12.11.0: minor.
  - `@types/node` 20.19.4 -> 20.19.41: patch on the current Node 20 type line.
  - `@types/react` 18.3.23 -> 18.3.30: patch on the React 18 type line.
  - `@types/katex` 0.16.7 -> 0.16.8: patch.
  - `@playwright/test` 1.57.0 -> 1.60.0: minor.
  - `vitest` 4.1.7 -> 4.1.8: patch.
  - `@vitest/coverage-v8` 4.1.7 -> 4.1.8: patch.
- Remaining direct dependency drift after refresh:
  - Next lane: `next` 15.5.18 remains behind wanted 15.5.19 and latest 16.2.7; `eslint-config-next` 15.5.18 remains behind wanted 15.5.19 and latest 16.2.7.
  - React lane: `react` and `react-dom` stay on 18.3.1 while latest is 19.2.7; `@types/react` stays on React 18 types while latest is 19.2.16; `@types/react-dom` stays on 18.3.7 while latest is 19.2.3; `lucide-react` stays on 0.263.1 while latest is 1.17.0.
  - Prisma lane: `@prisma/client` and `prisma` stay on 5.22.0 while latest is 7.8.0.
  - Tailwind/design-system lane: `autoprefixer` stays on 10.4.21 while wanted/latest is 10.5.0; `tailwindcss` stays on 3.4.19 while latest is 4.3.0; `tailwind-merge` stays on 1.14.0 while latest is 3.6.0.
  - 3D visualization lane: `@react-three/fiber` stays on 8.18.0 while latest is 9.6.1; `@react-three/drei` stays on 9.122.0 while latest is 10.7.7; `three` stays on 0.165.0 while latest is 0.184.0; `react-force-graph-2d` and `react-force-graph-3d` stay on 1.29.0 while wanted/latest is 1.29.1.
  - Governance/toolchain lane: `eslint` stays on 8.57.1 while latest is 10.4.1; `typescript` stays on 5.8.3 while wanted is 5.9.3 and latest is 6.0.3; `@types/node` stays on Node 20 types while latest is 25.9.1.
  - Validation/security runtime lane: `zod` stays on 3.25.76 while latest is 4.4.3; `bcryptjs` stays on 2.4.3 while latest is 3.0.3.
  - Runtime image lane: `sharp` stays on 0.33.5 while latest is 0.34.5.
  - Math/content lane: `katex` stays on 0.16.47 while latest is 0.17.0.
- Deferred owner mapping remains: ESLint 10, TypeScript 6, and `@types/node` 25 to governance/toolchain; Zod 4 and bcryptjs 3 to validation/security runtime; `lucide-react` 1 and React 19 type packages to React UI runtime; `tailwind-merge` 3 to Tailwind/design-system; Next/React/Prisma/Tailwind/3D packages to their dedicated migration changes.
- Audit result: `rtk npm audit --json` still reports 2 moderate findings from `next -> postcss`; no new finding is attributable to the refreshed packages, and `npm audit fix --force` remains out of scope because it proposes a breaking Next lane.
- Docker production dependency validation found that `autoprefixer` 10.5.0 resolves through `browserslist` 4.28.2 to `node-releases` 2.0.47, which exists on official npm but returned 404 from the default `npmmirror` registry on 2026-06-02. The change leaves `autoprefixer` on the existing direct range and adds Dockerfile npm-registry fallback so production dependency stages retry against official npm when the configured mirror lacks a tarball.
- Docker validation passed: `rtk docker build --target prod-deps --build-arg NPM_REGISTRY=https://registry.npmmirror.com --build-arg PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma -t act-obe-prod-deps-smoke:274 .` first hit the mirror 404 and then completed through the official-registry fallback; `rtk docker run --rm --entrypoint ./node_modules/.bin/tsx act-obe-prod-deps-smoke:274 --version` returned `tsx v4.22.4`; `rtk docker run --rm --entrypoint node act-obe-prod-deps-smoke:274 ./node_modules/prisma/build/index.js --version` returned Prisma 5.22.0.
- Validation passed: `rtk npm run test:docker-migration-readiness`, `rtk npx tsc --noEmit --pretty false`, `rtk npm run test`, `rtk npm run test:unit`, and `rtk npm run build`.
- Browser validation passed on `next start` at localhost:3001: `/login?callbackUrl=%2Fdata-center`, `/data-center` redirect to login, `/knowledge`, `/simulations`, `/interactive-learning/control-workbench`, and `/teacher` redirect to login all loaded without console errors; mobile `/login?callbackUrl=%2Fdata-center` at 390px had no horizontal overflow.
