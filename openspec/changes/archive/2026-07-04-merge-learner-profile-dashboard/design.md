## Design Notes

The canonical student personal-center route is `/profile`. Product language should present it as “个人中心”. `/dashboard` must remain compatible for existing links, but it must resolve to the `/profile` experience and must not remain a separate first-level destination with different content semantics.

Recommended canonical structure:

- `/profile`: primary Personal Center dispatch page.
- `/dashboard`: compatibility redirect or wrapper to `/profile`.
- `/profile/growth`, `/profile/portfolio`, `/profile/evidence`: secondary destinations reachable from the dispatch page.

The merged page should use the current dashboard as the information architecture base because it already acts as a route dispatcher. It should absorb the current profile page's durable content:

- learner identity and class binding;
- competency profile;
- learning statistics;
- recent activity;
- personalized reinforcement and adaptive practice state;
- evidence status and evidence timeline entry;
- Arena profile summary where available;
- join classroom/class entry where applicable.

The merged page must avoid stacking two hero cards or repeating the same “next action” in multiple modules.

All homepage, AppShell rail, account menu, and student role-cockpit actions that mean “个人中心” should target `/profile`. Links that historically mean “student dashboard” may keep `/dashboard` only as a compatibility entrypoint that resolves to `/profile`.
