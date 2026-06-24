## 1. Learner Data Shell

- [x] 1.1 Define shared learner data surface structure for profile, path, evidence, and practice.
- [x] 1.2 Migrate student dashboard and profile pages into the shared shell.
- [x] 1.3 Migrate growth center and evidence browser into grouped timeline and evidence-filter patterns.
- [x] 1.4 Migrate adaptive practice entry states into the same learner data language.

## 2. Navigation and States

- [x] 2.1 Preserve profile, cockpit, adaptive practice, and evidence route aliases.
- [x] 2.2 Display current path, recommended next steps, confidence, and missing-evidence states consistently.
- [x] 2.3 Confirm floating action dock placement and role visibility.

## 3. Verification

- [x] 3.1 Run `rtk openspec validate unify-learner-profile-pathway-surfaces --strict`.
- [x] 3.2 Run focused student route tests.
- [x] 3.3 Capture light/dark screenshots for learner data routes.

Verification note: Playwright captured 24 route/theme/viewport artifacts under `artifacts/learner-data-shell/20260604T150858Z/`, covering dashboard, profile, growth, evidence, adaptive practice stable/generate states, route identity markers, and mobile floating-control safe area evidence.
