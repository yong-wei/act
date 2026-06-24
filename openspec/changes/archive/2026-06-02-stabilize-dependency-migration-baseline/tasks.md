## 1. Baseline Capture

- [x] 1.1 Record Node, npm, package manager, engine range, and lockfile status.
- [x] 1.2 Record `npm outdated --long --json` and classify packages by low-risk, framework, database, design-system, visualization, and governance lanes.
- [x] 1.3 Record `npm audit --json`, including Next-owned PostCSS residuals and why unsafe automatic fixes must not be applied.
- [x] 1.4 Record production/dev dependency boundaries, including current Docker full-install behavior and worker/scheduler `tsx` usage.

## 2. Series Plan

- [x] 2.1 Define the dependent change order for the full latest-stable migration series.
- [x] 2.2 Define the compatibility-test matrix for development, production, database, UI, browser, and deployment checks.
- [x] 2.3 Identify browser routes and canvas pages that later changes must verify.
- [x] 2.4 Record owner changes or explicit deferral decisions for ESLint 10, TypeScript 6, `@types/node` 25, Zod 4, bcryptjs 3, `lucide-react` 1, and `tailwind-merge` 3.

## 3. Validation

- [x] 3.1 Run `rtk openspec validate stabilize-dependency-migration-baseline --strict`.
- [x] 3.2 Confirm the change does not modify package versions, lockfiles, application code, Docker runtime behavior, or tests.
