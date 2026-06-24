## Why

The current student-facing entry surfaces expose useful destinations, but they still read as unrelated internal modules. The homepage, Interactive Learning, Arena, adaptive practice, profile, and cockpit entries need one commercial product map with clear hierarchy, branded visual language, and stable access to learning, practice, challenge, experiment, and review flows.

## What Changes

- Define commercial student entry surfaces for homepage, student cockpit, Interactive Learning, Arena, adaptive learning, profile, and related student route aliases.
- Include login, authentication callback, authentication error, and account entry surfaces in the commercial entry system.
- Replace unreasonable legacy entry layouts instead of forcing them to inherit the old card-heavy structure.
- Align student destinations to learning intent: learn, practice, challenge, experiment, review, and account/profile.
- Require empty, loading, fallback, and feature-flagged states to remain visually complete and navigable.
- Define page-level acceptance for commercial visual hierarchy, responsive behavior, and route continuity.

## Capabilities

### New Capabilities
- `commercial-student-entry-surfaces`: Defines the commercial student product-map experience across public and authenticated student entry surfaces.

### Modified Capabilities
- `arena-student-entry-experience`: Adds commercial Arena hall and challenge-entry requirements.
- `adaptive-learning-center-ui`: Adds commercial adaptive entry, empty-state, and route-intent requirements.
- `platform-role-navigation`: Consumes the student intent grouping from the commercial navigation model.

## Impact

- Affects `/`, `/login`, authentication callback/error states, `/dashboard`, `/interactive-learning`, `/arena`, `/assessment/adaptive-practice`, `/profile`, and route aliases that enter those surfaces.
- Depends on `define-commercial-brand-language` and `refactor-commercial-platform-navigation`.
- Does not redesign dense workspaces such as the Control Workbench; those are handled by `upgrade-commercial-workspace-surfaces`.
