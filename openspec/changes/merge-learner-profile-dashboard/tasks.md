## Tasks

- [ ] 1. Define `/profile` as canonical Personal Center routing.
  - Make `/profile` the canonical route for student Personal Center.
  - Preserve `/dashboard` compatibility by redirecting or wrapping to `/profile` without presenting it as a separate first-level destination.

- [ ] 2. Merge dashboard and profile modules.
  - Use the dashboard dispatch structure as the base.
  - Add profile modules for competency, statistics, activity, reinforcement, evidence, and Arena summary.
  - Remove duplicate modules or conflicting page titles.

- [ ] 3. Consolidate data loading and states.
  - Ensure loading, unauthenticated, role redirect, empty data, and error states work consistently.
  - Keep teacher/admin redirects intact.

- [ ] 4. Validate navigation and visual behavior.
  - Run `rtk openspec validate merge-learner-profile-dashboard --strict`.
  - Run targeted tests for `/profile`, `/dashboard`, `/profile/growth`, `/profile/portfolio`, and `/profile/evidence`.
  - Capture desktop/mobile visual evidence for the merged Personal Center.
