## Why

Teacher workspaces and report-ledger layouts still use standalone topbars and horizontal operation navigation. This diverges from the unified AppShell rail used by primary student modules and keeps account/theme/navigation behavior inconsistent across roles.

The platform should use one first-level shell across student, teacher, and administrator surfaces, while preserving teacher/admin local operation navigation as secondary workflow controls.

## What Changes

- Migrate teacher and administrator role workspaces that still use static topbars into AppShell or registered AppShell-compatible wrappers.
- Preserve teacher/admin local operation navigation as secondary navigation, not first-level product navigation.
- Add role-aware Personal Center/account access and theme switching to the top-right shell action area consistently.
- Update route inventory and governance exceptions for any role workspace that cannot migrate immediately.
- Capture representative teacher/admin visual QA evidence.

## Impact

- Touches role workspace layouts, route inventory, and shell governance.
- Depends on canonical primary navigation ordering.
- Does not redesign the internal teacher/admin business modules.
