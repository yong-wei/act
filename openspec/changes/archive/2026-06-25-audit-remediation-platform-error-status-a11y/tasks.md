## 1. Recovery And Status Contracts

- [x] 1.1 Inventory invalid-id, permission, classroom-code, account menu, password, theme, and floating-control routes from the Product Design audit.
- [x] 1.2 Add product recovery states for known invalid platform routes and permission boundaries.
- [x] 1.3 Add status/live announcements for classroom-code errors, theme changes, password errors, and recovery actions.
- [x] 1.4 Preserve regression evidence that registration short-password and prep-pack missing-storage P0 issues remain closed.

## 2. Focus And Mobile Behavior

- [x] 2.1 Add or repair dialog/menu/floating-surface roles, focus containment, Escape behavior, and opener focus restoration.
- [x] 2.2 Verify global floating controls do not obstruct recovery actions at mobile widths.
- [x] 2.3 Update audit evidence with exact finding ids closed or partially closed.

## 3. Verification

- [x] 3.1 Add unit/source tests for product recovery payloads and `role=status`/`role=alert` usage.
- [x] 3.2 Add browser or Playwright checks for keyboard focus and mobile safe-area behavior.
- [x] 3.3 Run `rtk openspec validate audit-remediation-platform-error-status-a11y --strict`.
