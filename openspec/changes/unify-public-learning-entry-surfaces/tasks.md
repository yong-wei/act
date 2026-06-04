## 1. Entry Surface Migration

- [ ] 1.1 Migrate homepage and login into the premium entry shell.
- [ ] 1.2 Redesign Interactive Learning and course catalog as learning-map or module-path surfaces.
- [ ] 1.3 Redesign simulation hub as a scenario fleet or task library using existing 3D assets.
- [ ] 1.4 Preserve authenticated, unauthenticated, loading, disabled, and feature-flagged states.

## 2. Navigation

- [ ] 2.1 Wire public entry and learning pages to the central navigation model.
- [ ] 2.2 Preserve login callback, role redirect, and profile/cockpit semantics.
- [ ] 2.3 Confirm floating action dock placement follows the foundation contract.

## 3. Verification

- [ ] 3.1 Run `rtk openspec validate unify-public-learning-entry-surfaces --strict`.
- [ ] 3.2 Run focused route/navigation tests for affected pages.
- [ ] 3.3 Capture background browser screenshots for affected routes in light and dark themes.
