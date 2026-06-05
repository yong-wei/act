## Why

The redesign cannot be governed by a small representative route matrix alone. The project needs a route inventory and migration ledger that assigns every primary page to one archetype, one owning migration change, one navigation frame, and one visual QA profile.

## What Changes

- Create or extend a primary route inventory for public, student, workspace, knowledge/data, learner record, teacher, admin, and report surfaces.
- Add a migration ledger with archetype, role scope, theme support, auth state, dock behavior, owning change, exception reason, and removal condition.
- Use the ledger to prevent duplicate ownership of cross-cutting routes such as `/data-center`, `/knowledge`, and `/admin/data-governance`.
- Explicitly assign or except classroom student/player routes, course private player routes, teacher Arena, class analytics, student detail, AI, and AI copilot routes.
- Register report-ledger route or component inventory before report/export visual migration begins.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `platform-role-navigation`: adds full primary route inventory and ownership requirements.
- `platform-design-system-and-shell`: adds migration ledger and shell retirement tracking requirements.

## Impact

- Affects route inventory data, navigation tests, shell governance, commercial UI governance inputs, and downstream page-family migration scopes.
