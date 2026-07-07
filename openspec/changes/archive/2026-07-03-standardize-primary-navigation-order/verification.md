## Verification

- `rtk npm run test:unit -- src/lib/__tests__/platform-role-navigation.test.ts src/lib/__tests__/platform-ui-contracts.test.ts src/app/__tests__/platform-entrypoints-smoke.test.ts`
  - Passed 78 tests.
  - `platform-ui-contracts.test.ts` verifies expanded AppShell label order, collapsed rail `aria-label` order, collapsed `title`, and active `aria-current` for the learning path route.
- `rtk openspec validate standardize-primary-navigation-order --strict`
  - Passed.
- `rtk npm run lint`
  - Passed.
- `rtk npm run build`
  - Passed with existing Turbopack broad-pattern warnings in `src/lib/data-governance/document-rubric-grading-workbench.ts`.
