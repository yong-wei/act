## Tasks

- [x] 1. Inventory role workspace shell divergence.
  - Identify teacher/admin layouts and primary routes still using static topbars or competing first-level navigation.
  - Classify each target as migrate-now or temporary exception.

- [x] 2. Migrate selected role workspace frames.
  - Wrap teacher/admin primary workspaces in AppShell or AppShell-compatible adapters.
  - Move teacher/admin operation navigation into secondary slots or local workflow controls.

- [x] 3. Standardize role-aware personal center/account and theme actions.
  - Ensure student role workspaces resolve 个人中心 to `/profile`.
  - Ensure teacher/admin role workspaces expose a documented role-aware 个人中心/account target rather than the student learner-record profile.
  - Ensure theme switching appears in the top-right shell action area.
  - Preserve role redirects and authorization behavior.

- [x] 4. Validate role visual QA.
  - Run `rtk openspec validate migrate-role-workspaces-to-appshell-navigation --strict`.
  - Run route/shell governance checks.
  - Capture `/teacher`, one teacher secondary operation page, `/admin`, and one administrator secondary page.
  - Include desktop collapsed rail, desktop expanded rail, and 320px mobile navigation states where applicable.

## Evidence

- `rtk npm run test:unit -- src/lib/__tests__/platform-ui-contracts.test.ts`
- `rtk npm run lint`
- `rtk openspec validate migrate-role-workspaces-to-appshell-navigation --strict`
- `rtk git diff --check`
- `rtk proxy npx playwright test tests/role-workspace-appshell-navigation-801.spec.ts`
- `rtk npx tsc --noEmit --pretty false` failed on existing unrelated type errors; filtering the output for changed files returned no matches.
- Source-contract evidence: `artifacts/commercial-ui/role-workspace-appshell-navigation-801/evidence.json`
- Fresh browser screenshot manifest: `artifacts/commercial-ui/role-workspace-appshell-navigation-801/playwright/screenshots.json`
