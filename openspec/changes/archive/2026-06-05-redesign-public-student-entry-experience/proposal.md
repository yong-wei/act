## Why

Public and student entry pages still behave like route directories instead of a coherent learning journey. The redesign must make homepage, login, Interactive Learning, course catalog, simulation, Arena, and adaptive entry surfaces express the same student intent model and premium brand language.

## What Changes

- Redesign public/auth/student entry surfaces around a single learning intent map.
- Make homepage and login preserve role and callback intent while reducing competing CTAs.
- Convert `/interactive-learning` from an explanatory card page into a student learning control page.
- Move secondary component-library paths below primary course/practice/challenge/experiment flows.
- Prioritize current class, current lesson/session, active assignment, next practice, Arena task, or experiment path over generic module directories when such context exists.
- Verify student flow from login callback to current learning work and then to learner record or evidence review.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-student-entry-surfaces`: adds entry-page composition and mobile flow requirements.
- `platform-role-navigation`: strengthens student intent consistency across public, auth, cockpit, and mobile surfaces.

## Impact

- Affects `/`, `/login`, auth callback/error surfaces, `/interactive-learning`, `/interactive-learning/courses`, `/simulations`, `/arena`, `/assessment/adaptive-practice`, and related navigation tests/screenshots.
