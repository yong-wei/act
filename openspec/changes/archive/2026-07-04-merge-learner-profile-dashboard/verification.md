## Verification

- `rtk npm run test:unit -- src/lib/__tests__/platform-role-navigation.test.ts src/app/__tests__/platform-entrypoints-smoke.test.ts src/lib/__tests__/platform-ui-contracts.test.ts src/lib/__tests__/commercial-ui-governance.test.ts src/lib/__tests__/adaptive-learning-center-ui.test.ts`
- `rtk npx playwright test tests/platform-entrypoints.spec.ts -g "dashboard compatibility resolves to canonical profile entry"`
- `rtk npx openspec validate merge-learner-profile-dashboard --strict`
- `rtk npm run lint`
- `rtk proxy git diff --check`

Visual evidence:

- `artifacts/visual-qa/merge-learner-profile-dashboard/profile-desktop.png`
- `artifacts/visual-qa/merge-learner-profile-dashboard/profile-mobile.png`
- `artifacts/visual-qa/merge-learner-profile-dashboard/profile-visual-evidence.json`
