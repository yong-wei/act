## Why

The current navigation works technically but mixes global modules, role cockpits, profile actions, Arena context, and page-local return links. A commercial platform needs a deliberate navigation hierarchy before high-end visual redesign can be consistent.

## What Changes

- Define a three-layer navigation model: global product navigation, role cockpit navigation, and contextual workspace navigation.
- Allow replacement of legacy shells that conflict with the commercial hierarchy rather than preserving them through permanent adapters.
- Define contextual shell behavior for Arena, Control Workbench, interactive learning, adaptive learning, teacher, and admin surfaces.
- Clarify how breadcrumbs, return targets, user/profile actions, cockpit actions, and authentication callback routes coexist without duplicating entrypoints.

## Capabilities

### New Capabilities

### Modified Capabilities
- `platform-role-navigation`: Adds commercial navigation hierarchy, role intent grouping, and contextual navigation requirements.
- `platform-design-system-and-shell`: Adds shell retirement and contextual shell requirements for commercial navigation.

## Impact

- Affects `src/lib/platform-role-navigation.ts`, `src/components/platform/app-shell.tsx`, `src/components/shared/unified-top-bar.tsx`, `src/features/arena/arena-page-shell.tsx`, role layouts, and page-level headers.
- Depends on `define-commercial-brand-language`.
