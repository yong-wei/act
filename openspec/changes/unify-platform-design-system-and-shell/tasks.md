## 1. Foundation Contracts

- [ ] 1.1 Define semantic token names for canvas, surfaces, foreground, border, action, evidence, privacy, replay, and evaluation states.
- [ ] 1.2 Define `AppShell`, `AppHeader`, `AppSidebar`, `AppBreadcrumb`, `ThemeSwitcher`, and base surface primitive contracts.
- [ ] 1.3 Define a role-aware navigation schema with stable ordering and feature-flag support.
- [ ] 1.4 Define ownership rules that keep `src/components` presentation-only while feature orchestration remains in `src/features`, resource implementations remain in `src/resources`, and course-resource resolution remains registry-driven.

## 2. Migration Guardrails

- [ ] 2.1 Add adapter guidance for `FeaturePageNav`, `UnifiedTopBar`, `ArenaPageShell`, teacher layout, and admin header.
- [ ] 2.2 Add guardrails that prevent new product pages from introducing page-local shells or untracked hard-coded palettes.
- [ ] 2.3 Document rollback behavior for the unified shell feature flag.
- [ ] 2.4 Add migration guidance that forbids moving course runtime, ResourceNode, Arena, simulation, adaptive, or governance rules into shared shell primitives.

## 3. Validation

- [ ] 3.1 Add tests or source checks for token, navigation, and shell contracts.
- [ ] 3.2 Validate with `rtk proxy openspec validate unify-platform-design-system-and-shell --strict`.
