## 1. Shared Shell Behavior

- [ ] 1.1 Update AppShell collapsible layout so collapsed desktop navigation reserves a narrow rail and the content column expands.
- [ ] 1.2 Replace first-character collapsed labels with registered icon rendering plus accessible labels and focus-visible states.
- [ ] 1.3 Preserve expanded sidebar behavior, mobile drawer behavior, active route matching, and nested route semantics.

## 2. Verification

- [ ] 2.1 Add or update AppShell contract tests for expanded width, collapsed width, visible text, accessible labels, and active state.
- [ ] 2.2 Capture browser evidence for `/arena` and `/interactive-learning/control-workbench` in expanded and collapsed desktop navigation states.
- [ ] 2.3 Verify no horizontal overflow or content overlap at 1440px and 320px representative viewports.

## 3. Validation

- [ ] 3.1 Run platform UI contract tests covering AppShell.
- [ ] 3.2 Run commercial UI governance checks relevant to shell navigation state.
- [ ] 3.3 Run `rtk openspec validate fix-app-shell-collapsed-navigation-contract --strict`.
