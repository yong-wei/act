## Why

Public entry, login, Interactive Learning, course catalog, and simulation hub currently show different UI languages. The simulation hub has strong visual assets, while login and learning pages still read as generic card pages.

This change migrates public and learning-entry surfaces onto the premium foundation, assuming unfinished adaptive/path and assistant capabilities will be available as future destinations.

## What Changes

- Redesign homepage and login as part of the same premium product entry system.
- Convert Interactive Learning and course catalog from disconnected card grids into a learning map or module-path entry model.
- Upgrade simulation hub from generic cards into a visually coherent scenario fleet or task library.
- Preserve route access, authentication callbacks, and student intent grouping.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `commercial-student-entry-surfaces`: add public, login, interactive, course, and simulation entry migration requirements.
- `platform-role-navigation`: add public-to-role and learning-entry route semantics.

## Impact

- Affects `/`, `/login`, `/interactive-learning`, `/interactive-learning/courses`, representative course detail pages, and `/simulations`.
- Depends on `define-premium-platform-ui-foundation`.
- Does not implement immersive simulation scenes or learner profile data pages.
