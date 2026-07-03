## Design Notes

The migration should not flatten teacher/admin workflows into student module navigation. The first-level rail provides global orientation. Teacher operation tabs, class-level tabs, report filters, and admin domain tabs remain local or secondary controls.

Representative targets include:

- `src/app/teacher/layout.tsx`
- `src/app/(teacher-report-ledger)/teacher/layout.tsx`
- administrator workspaces that retain static headers or non-AppShell frame ownership

The AppShell top-right action area should expose role-aware Personal Center/account access and theme switching consistently. For students, “个人中心” resolves to `/profile`. For teachers and administrators, “个人中心” means the role account/operations landing context, not the student learner-record profile; implementation should either provide explicit `/teacher/profile` and `/admin/profile` account-center routes or a registered role-aware account-center target with the same visible label and documented destination. If a role page needs extra actions, they should use AppShell `actions` or workspace slots rather than a separate page-local header.

Visual evidence should cover at least:

- `/teacher`;
- one teacher secondary operation page;
- `/admin`;
- one administrator secondary page;
- desktop collapsed rail, desktop expanded rail, and 320px mobile navigation states where the route supports them.

Routes that cannot migrate in the first pass must declare a temporary exception with owner, reason, affected route, and removal condition in the route ledger or governance allowlist.
