## 1. Navigation Contract

- [x] 1.1 Define global, role, and contextual navigation layers in the central navigation model.
- [x] 1.2 Define student learning-intent grouping and route compatibility aliases.
- [x] 1.3 Define profile versus cockpit action semantics across public, student, teacher, and admin pages.
- [x] 1.4 Define authentication callback, login error, profile return, and role cockpit routing semantics.

## 2. Shell Migration Strategy

- [x] 2.1 Identify legacy shells that can be retired rather than adapted.
- [x] 2.2 Define derived workspace shell contracts for Arena, Control Workbench, interactive learning, adaptive learning, teacher, and admin.
- [x] 2.3 Add route-derived return target rules for workbench and challenge flows.

## 3. Validation

- [x] 3.1 Add navigation schema tests for layers, groups, aliases, profile/cockpit separation, and return targets.
- [x] 3.2 Add responsive smoke checks for global and contextual navigation at desktop and 320px.
- [x] 3.3 Add route smoke checks for `/login?callbackUrl=%2Fprofile` and role-aware post-login destinations.
- [x] 3.4 Validate with `rtk proxy openspec validate refactor-commercial-platform-navigation --strict`.
