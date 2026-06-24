## 1. Teacher Operations

- [x] 1.1 Define teacher operations navigation and workspace shell.
- [x] 1.2 Migrate teacher dashboard, classes, lesson plans, resources, and history surfaces.
- [x] 1.3 Add visual slots for future student/class learning analytics without creating fake data.

## 2. Admin Console

- [x] 2.1 Define admin console navigation for users, model/settings, system settings, usage, and governance.
- [x] 2.2 Migrate admin dashboard, users, config, states, and data governance surfaces.
- [x] 2.3 Align metrics, tables, filters, risk states, and management actions.

## 3. Verification

- [x] 3.1 Run `rtk openspec validate unify-teacher-admin-operations-surfaces --strict`.
- [x] 3.2 Run role route smoke tests for teacher and admin.
- [x] 3.3 Capture light/dark screenshots for representative operations routes.

Verification notes:

- `rtk openspec validate unify-teacher-admin-operations-surfaces --strict` passed.
- `rtk npm run test`, `rtk npm run test:unit`, `rtk npm run lint`, and `rtk proxy git diff --check` passed.
- Teacher/admin route smoke and light/dark screenshot evidence: `artifacts/teacher-admin-operations-surfaces/20260604T190319Z/manifest.json` (`results=21`, `failures=0`), including explicit `feature-flagged` unavailable slots for teacher class/student analytics and admin model management with `fabricatesMetrics=false`.
- `rtk npx tsc --noEmit --pretty false` was run after fixing the data-governance marker type issue; remaining failures are pre-existing TypeScript errors outside this change in learning-path execution, control-correction path rounds, and data-governance evidence cache modules.
