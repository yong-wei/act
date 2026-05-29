## 1. Foundation Contracts

- [x] 1.1 Define semantic token names for canvas, surfaces, foreground, border, action, evidence, privacy, replay, and evaluation states.
- [x] 1.2 Define `AppShell`, `AppHeader`, `AppSidebar`, `AppBreadcrumb`, `ThemeSwitcher`, and base surface primitive contracts.
- [x] 1.3 Define a role-aware navigation schema with stable ordering and feature-flag support.
- [x] 1.4 Define ownership rules that keep `src/components` presentation-only while feature orchestration remains in `src/features`, resource implementations remain in `src/resources`, and course-resource resolution remains registry-driven.

## 2. Migration Guardrails

- [x] 2.1 Add adapter guidance for `FeaturePageNav`, `UnifiedTopBar`, `ArenaPageShell`, teacher layout, and admin header.
- [x] 2.2 Add guardrails that prevent new product pages from introducing page-local shells or untracked hard-coded palettes.
- [x] 2.3 Document rollback behavior for the unified shell feature flag.
- [x] 2.4 Add migration guidance that forbids moving course runtime, ResourceNode, Arena, simulation, adaptive, or governance rules into shared shell primitives.

## 3. Validation

- [x] 3.1 Add tests or source checks for token, navigation, and shell contracts.
- [x] 3.2 Validate with `rtk proxy openspec validate unify-platform-design-system-and-shell --strict`.
