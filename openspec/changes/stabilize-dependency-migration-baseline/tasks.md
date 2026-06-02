## 1. Baseline Capture

- [ ] 1.1 Record Node, npm, package manager, engine range, and lockfile status.
- [ ] 1.2 Record `npm outdated --long --json` and classify packages by low-risk, framework, database, design-system, visualization, and governance lanes.
- [ ] 1.3 Record `npm audit --json`, including Next-owned PostCSS residuals and why unsafe automatic fixes must not be applied.
- [ ] 1.4 Record production/dev dependency boundaries, including current Docker full-install behavior and worker/scheduler `tsx` usage.

## 2. Series Plan

- [ ] 2.1 Define the dependent change order for the full latest-stable migration series.
- [ ] 2.2 Define the compatibility-test matrix for development, production, database, UI, browser, and deployment checks.
- [ ] 2.3 Identify browser routes and canvas pages that later changes must verify.
- [ ] 2.4 Record owner changes or explicit deferral decisions for ESLint 10, TypeScript 6, `@types/node` 25, Zod 4, bcryptjs 3, `lucide-react` 1, and `tailwind-merge` 3.

## 3. Validation

- [ ] 3.1 Run `rtk openspec validate stabilize-dependency-migration-baseline --strict`.
- [ ] 3.2 Confirm the change does not modify package versions, lockfiles, application code, Docker runtime behavior, or tests.
