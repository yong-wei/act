## Why

The full-system Product Design audit shows that many invalid routes, permission boundaries, modal/floating controls, and state transitions still lack product-level recovery, focus containment, and `status/live` evidence. The first remediation batch created shared status and mobile/a11y foundations; this change makes those foundations mandatory on platform-level error and accessibility flows that are not covered by the active KAQ, resource, path, or interactive-lesson changes.

## What Changes

- Add a platform error and status contract for invalid object ids, unauthorized role access, classroom-code errors, theme changes, password changes, floating-tool menus, and global recovery pages.
- Require visible recovery actions, user-safe object names, and `role=status` or `role=alert` announcements for platform errors and completed actions.
- Require modal/menu/floating surfaces to expose dialog/menu semantics, focus containment, Escape behavior, opener focus restoration, and mobile safe-area behavior.
- Add regression evidence that the registered P0 short-password error remains fixed and that new work does not reopen the P0 stability findings.
- Exclude adaptive path planning, KAQ evidence, resource-field completion, Graph Center actions, and interactive lesson courseware styling from this change.

## Capabilities

### New Capabilities
- `audit-remediation-platform-error-status-a11y`: audit remediation contract for product-level errors, recovery actions, action announcements, focus containment, and mobile safe-area behavior.

### Related Capabilities
- `audit-remediation-action-status-contract`: require concrete platform-level consumers for status/live, not only the shared foundation.
- `audit-remediation-mobile-a11y-shell`: extend representative shell coverage to remaining platform-level menu, modal, error, and floating-control flows.
- `audit-remediation-p0-stability`: require regression evidence that P0 registration and prep-pack stability fixes stay closed.

## Impact

- Affects platform error pages, invalid-id route handling, classroom join errors, account menu/change-password modal, global floating controls, theme switching, and route/permission recovery UI.
- Evidence sources include `chapters/40-function-state-flows-batch32.md`, `chapters/42-function-state-flows-batch34.md`, `chapters/49-function-state-flows-batch41.md`, `chapters/52-function-state-flows-batch44.md`, and later status-flow chapters in the full-system Product Design audit.
- Acceptance requires targeted unit or browser evidence for focus behavior, `aria-live`/`role=status`, product recovery actions, and P0 stability regression.
