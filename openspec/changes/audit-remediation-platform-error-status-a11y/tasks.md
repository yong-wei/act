## 1. Recovery And Status Contracts

- [ ] 1.1 Inventory invalid-id, permission, classroom-code, account menu, password, theme, and floating-control routes from the Product Design audit.
- [ ] 1.2 Add product recovery states for known invalid platform routes and permission boundaries.
- [ ] 1.3 Add status/live announcements for classroom-code errors, theme changes, password errors, and recovery actions.
- [ ] 1.4 Preserve regression evidence that registration short-password and prep-pack missing-storage P0 issues remain closed.

## 2. Focus And Mobile Behavior

- [ ] 2.1 Add or repair dialog/menu/floating-surface roles, focus containment, Escape behavior, and opener focus restoration.
- [ ] 2.2 Verify global floating controls do not obstruct recovery actions at mobile widths.
- [ ] 2.3 Update audit evidence with exact finding ids closed or partially closed.

## 3. Verification

- [ ] 3.1 Add unit/source tests for product recovery payloads and `role=status`/`role=alert` usage.
- [ ] 3.2 Add browser or Playwright checks for keyboard focus and mobile safe-area behavior.
- [ ] 3.3 Run `rtk openspec validate audit-remediation-platform-error-status-a11y --strict`.

