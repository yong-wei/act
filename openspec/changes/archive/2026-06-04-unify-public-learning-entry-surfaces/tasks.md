## 1. Entry Surface Migration

- [x] 1.1 Migrate homepage and login into the premium entry shell.
- [x] 1.2 Redesign Interactive Learning and course catalog as learning-map or module-path surfaces.
- [x] 1.3 Redesign simulation hub as a scenario fleet or task library using existing 3D assets.
- [x] 1.4 Preserve authenticated, unauthenticated, loading, disabled, and feature-flagged states.

## 2. Navigation

- [x] 2.1 Wire public entry and learning pages to the central navigation model.
- [x] 2.2 Preserve login callback, role redirect, and profile/cockpit semantics.
- [x] 2.3 Confirm floating action dock placement follows the foundation contract.

## 3. Verification

- [x] 3.1 Run `rtk openspec validate unify-public-learning-entry-surfaces --strict`.
- [x] 3.2 Run focused route/navigation tests for affected pages.
- [x] 3.3 Capture background browser screenshots for affected routes in light and dark themes.

## Verification Notes

- `rtk openspec validate unify-public-learning-entry-surfaces --strict`
- `rtk npx vitest run src/lib/__tests__/platform-role-navigation.test.ts`
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 rtk proxy npx playwright test tests/platform-entrypoints.spec.ts tests/interactive-learning-entry-routes.spec.ts --reporter=line`
- `rtk npm run test`
- `rtk npm run test:unit`
- `rtk npx tsc --noEmit --pretty false`
- `rtk npm run lint`
- `rtk proxy git diff --check`
- Visual QA artifact: `artifacts/public-learning-entry-surfaces/20260604T180215Z/manifest.json` (`pages=24`, `non200=0`, `pageErrors=0`, `markerMisses=0`)
