## Context

The audit already produced shared foundations: `ActionStatusPanel`, mobile shell/a11y remediation, and P0 stability fixes. The remaining platform issues are concrete consumers: invalid ids, permission redirects, classroom code errors, account/floating menus, theme/password actions, and default error pages.

## Design

1. Centralize product recovery states for platform errors.
   - Invalid object ids must show the object type, safe display id or label, reason, and recovery actions.
   - Permission failures must distinguish unauthenticated, wrong role, missing object, and stale link.
   - Default Next 404 surfaces must not be the primary recovery UI for known platform routes.

2. Apply the status/live foundation to platform actions.
   - Classroom-code failure, theme switch, password change, menu/floating-tool open/close, and route recovery actions must emit visible status or alert semantics.
   - Success, blocked, unsupported, loading, and retry states must use product copy rather than raw ids or implementation errors.

3. Fix focus and modal/menu behavior.
   - Account menu, change-password dialog, floating-tool menu, global recovery panels, and invalid-route actions must have predictable keyboard order.
   - Escape closes transient UI where appropriate and restores focus to the opener.

4. Preserve prior P0 closures.
   - Registration short-password and prep-pack missing-table states remain regression checks, not new implementation scope.

## Out Of Scope

- Adaptive path generation, KAQ evidence, resource metadata, Graph Center actions, interactive lesson courseware style, and teacher report delivery internals.

## Evidence

- Update audit remediation evidence with specific finding ids closed or partially closed.
- Capture source or browser evidence for invalid route, account modal, floating menu, and classroom-code failure states.

