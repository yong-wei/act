## Why

Teacher and admin surfaces currently provide navigation and honest unavailable states, but they still read as directory consoles rather than action-prioritized operating desks. They need one operations-console archetype for class, lesson, resource, analytics, user, config, state, and governance workflows.

## What Changes

- Redesign teacher operations around active classes, pending actions, lesson/resource preparation, history, and analytics states.
- Redesign admin operations around risks, pending tasks, user/system/config/governance channels, and honest unavailable capabilities.
- Keep table, filter, metric, risk, save/reset, and feature-flagged states consistent across teacher and admin.
- Verify teacher workflow from class to lesson plan, resource or ResourceNode, classroom launch, student evidence, history, analytics, and report entry.
- Verify admin workflow from user/config change to governance status, source coverage or session quality, repair action, restricted explanation, and redacted report/export entry.
- Keep `/admin/data-governance`, `/data-center`, and report-ledger snapshots under distinct route ownership.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `teacher-admin-governance-workspaces-ui`: adds operations-console hierarchy and mobile behavior.
- `admin-data-governance-dashboard`: adds admin governance visual hierarchy and status behavior.

## Impact

- Affects `/teacher`, teacher classes/lesson-plans/resources/history/analytics routes, `/admin`, admin users/config/states/data-governance routes, operations shell components, and governance dashboard UI.
