## Tasks

- [x] 1. Split theme switching from bottom floating controls.
  - Remove the implicit theme item from the bottom-right floating menu.
  - Ensure AppShell or homepage top-right controls provide theme switching.
  - Verify homepage top-right theme switching is available before removing the bottom-dock theme fallback.

- [x] 2. Make Konling a direct floating action.
  - When Konling is available, clicking the bottom-right button opens Konling directly.
  - Preserve route context registration and unread state where applicable.

- [x] 3. Handle routes with additional controls.
  - Move non-Konling controls to approved shell slots or secondary patterns.
  - Avoid reintroducing a generic “工具” trigger as the primary action.

- [x] 4. Validate visual and interaction behavior.
  - Run `rtk openspec validate simplify-konling-floating-entry --strict`.
  - Capture representative desktop/mobile evidence for `/knowledge`, `/interactive-learning`, `/assessment/adaptive-practice`, `/arena`, and `/simulations`.
  - Verify keyboard reachability and no overlap with local panels.

## Evidence

- `rtk npm run test:unit -- src/lib/__tests__/platform-ui-contracts.test.ts src/features/interactive/__tests__/floating-controls.test.ts src/app/__tests__/platform-recovery-source.test.ts src/app/__tests__/platform-entrypoints-smoke.test.ts`
- `rtk npm run lint`
- `rtk npx tsc --noEmit --pretty false 2>&1 | rtk rg "src/(components/shared/page-floating-controls\\.tsx|components/platform/app-shell\\.tsx|app/assessment/adaptive-practice/page\\.tsx|features/interactive/__tests__/floating-controls\\.test\\.ts|app/__tests__/platform-recovery-source\\.test\\.ts|app/__tests__/platform-entrypoints-smoke\\.test\\.ts)"`
- `rtk openspec validate simplify-konling-floating-entry --strict`
- `rtk git diff --check`
- Playwright visual evidence: `/tmp/simplify-konling-floating-entry-evidence/summary-final.json`
