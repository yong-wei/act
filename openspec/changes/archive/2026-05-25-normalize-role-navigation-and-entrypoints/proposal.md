## Why

The report identifies a navigation mismatch: the strongest product workflow is Arena to challenge detail to Control Workbench, while student entrypoints still emphasize a partial module set. The future baseline adds ResourceNodes, adaptive paths, Konling, evidence governance, and teacher management, so role entrypoints must be formalized before page migration.

## What Changes

- Normalize homepage, login, student cockpit, teacher cockpit, and admin cockpit entrypoints under one role-navigation model.
- Promote simulation, knowledge/resource workspace, Arena, Control Workbench, adaptive learning, and profile to first-class student destinations.
- Make homepage, login, student dashboard, and profile migration verifiable through concrete entry matrix, shared auth form, mobile drawer, and route-smoke requirements.
- Preserve future-gated entries for ResourceNode management, adaptive path visualization, Konling, data center, and governance surfaces.
- Keep role redirection and existing compatible routes stable.

## Capabilities

### New Capabilities
- `platform-role-navigation`: Defines role-specific entrypoints, navigation order, route compatibility, and feature-flag behavior.

## Impact

- Affects homepage, auth layout/login, student dashboard, teacher layout/home, admin home, and shared navigation configuration.
- Depends on `unify-platform-design-system-and-shell`.
