## 1. Shared Shell Behavior

- [x] 1.1 Update AppShell collapsible layout so collapsed desktop navigation reserves a narrow rail and the content column expands.
- [x] 1.2 Replace first-character collapsed labels with registered icon rendering plus accessible labels and focus-visible states.
- [x] 1.3 Preserve expanded sidebar behavior, mobile drawer behavior, active route matching, and nested route semantics.

## 2. Verification

- [x] 2.1 Add or update AppShell contract tests for expanded width, collapsed width, visible text, accessible labels, and active state.
- [x] 2.2 Capture browser evidence for `/arena` and `/interactive-learning/control-workbench` in expanded and collapsed desktop navigation states across light and dark themes.
- [x] 2.3 Verify no horizontal overflow or content overlap at 1440px and 320px representative viewports.

## 3. Validation

- [x] 3.1 Run platform UI contract tests covering AppShell.
- [x] 3.2 Run commercial UI governance checks relevant to shell navigation state.
- [x] 3.3 Run `rtk openspec validate fix-app-shell-collapsed-navigation-contract --strict`.

## Evidence

- Browser evidence: `artifacts/commercial-ui/app-shell-collapsed-navigation-413/manifest.json`; screenshots cover `/arena` and `/interactive-learning/control-workbench` in light and dark themes.
- `/arena`: expanded `248px 1192px`, collapsed `72px 1368px`, collapsed active link aria/title `竞技场`, visible text empty, no horizontal overflow, mobile has drawer and no persistent sidebar.
- `/interactive-learning/control-workbench`: expanded `248px 1192px`, collapsed `72px 1368px`, collapsed active link aria/title `控制工作台`, visible text empty, no horizontal overflow, mobile has drawer and no persistent sidebar.
- Validation: `npm run test:unit -- src/lib/__tests__/platform-ui-contracts.test.ts src/lib/__tests__/commercial-ui-governance.test.ts`, `npm run test:commercial-ui-governance`, `npx tsc --noEmit --pretty false`, `openspec validate fix-app-shell-collapsed-navigation-contract --type change --strict`.
