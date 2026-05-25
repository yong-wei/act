## 1. Navigation Model

- [x] 1.1 Define student, teacher, admin, and unauthenticated navigation groups.
- [x] 1.2 Define stable order for core student modules and role cockpit links.
- [x] 1.3 Add feature-flag metadata for future ResourceNode, adaptive path, Konling, governance, and experiment entries.

## 2. Entrypoint Migration

- [x] 2.1 Update homepage and role cockpit contracts to consume shared navigation data.
- [x] 2.2 Preserve existing route aliases and role redirects during migration.
- [x] 2.3 Define mobile drawer behavior and action-slot priorities.
- [x] 2.4 Define homepage six-entry matrix behavior, shared login form reuse, student dashboard entry ordering, profile/cockpit actions, and 320px drawer access.

## 3. Validation

- [x] 3.1 Add tests for role visibility, ordering, route targets, and disabled feature-gated entries.
- [x] 3.2 Add route or browser smoke checks for `/`, `/login`, `/dashboard`, and `/profile` across desktop and 320px mobile widths.
- [x] 3.3 Validate with `rtk proxy openspec validate normalize-role-navigation-and-entrypoints --strict`.
