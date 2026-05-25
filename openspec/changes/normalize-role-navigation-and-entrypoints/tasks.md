## 1. Navigation Model

- [ ] 1.1 Define student, teacher, admin, and unauthenticated navigation groups.
- [ ] 1.2 Define stable order for core student modules and role cockpit links.
- [ ] 1.3 Add feature-flag metadata for future ResourceNode, adaptive path, Konling, governance, and experiment entries.

## 2. Entrypoint Migration

- [ ] 2.1 Update homepage and role cockpit contracts to consume shared navigation data.
- [ ] 2.2 Preserve existing route aliases and role redirects during migration.
- [ ] 2.3 Define mobile drawer behavior and action-slot priorities.
- [ ] 2.4 Define homepage six-entry matrix behavior, shared login form reuse, student dashboard entry ordering, profile/cockpit actions, and 320px drawer access.

## 3. Validation

- [ ] 3.1 Add tests for role visibility, ordering, route targets, and disabled feature-gated entries.
- [ ] 3.2 Add route or browser smoke checks for `/`, `/login`, `/dashboard`, and `/profile` across desktop and 320px mobile widths.
- [ ] 3.3 Validate with `rtk proxy openspec validate normalize-role-navigation-and-entrypoints --strict`.
