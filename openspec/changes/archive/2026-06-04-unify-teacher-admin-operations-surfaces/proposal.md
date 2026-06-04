## Why

Teacher and administrator pages contain important operational functions, but their visual structure remains generic and inconsistent with student, simulation, and data surfaces. Future student/class learning analytics and model/system management need a unified operations navigation model now.

This change defines and migrates teacher and admin surfaces into a shared operations console language.

## What Changes

- Unify teacher dashboard, classes, lesson plans, resources, and history as a teaching operations workspace.
- Unify admin dashboard, users, model/settings, system settings, usage statistics, and data governance as an admin console workspace.
- Establish operations density rules for metrics, tables, filters, risk states, and action placement.
- Preserve teacher/admin authorization, ResourceNode ownership, governance privacy, and future model management assumptions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `teacher-admin-governance-workspaces-ui`: add teacher/admin operations console requirements.
- `admin-data-governance-dashboard`: add analytics density and management navigation requirements.

## Impact

- Affects `/teacher`, `/teacher/classes`, `/teacher/lesson-plans`, `/teacher/resources`, `/teacher/history`, `/admin`, `/admin/users`, `/admin/config`, `/admin/states`, and `/admin/data-governance`.
- Depends on `define-premium-platform-ui-foundation`.
- Does not alter user/model/system data contracts beyond navigation and presentation.
