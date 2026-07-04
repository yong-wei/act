## Why

Student Profile and Student Dashboard currently duplicate learning entry, learner evidence, competency profile, activity, and next-step semantics. Keeping both as first-level destinations makes the platform harder to explain and creates inconsistent account/cockpit language.

The product target is one Personal Center dispatch page based on the current dashboard structure, enriched with profile modules such as competency profile, learning record, recent activity, evidence review, and adaptive practice status.

## What Changes

- Make `/profile` the single student-facing first-level Personal Center and learner-record destination.
- Use the existing dashboard layout as the base dispatch page and integrate profile modules into it.
- Preserve `/dashboard` as a compatibility redirect or wrapper to `/profile` so old links and role-cockpit redirects do not break.
- Keep `/profile/growth`, `/profile/portfolio`, and `/profile/evidence` reachable as subviews or secondary report-ledger routes.
- Update navigation, account menu, and role cockpit semantics so student users are not offered two equivalent destinations.

## Impact

- Touches student profile/dashboard routes and role navigation semantics.
- Requires data loading consolidation because `/dashboard` is server-rendered while `/profile` currently fetches client-side profile data.
- Does not redesign teacher/admin user centers.
