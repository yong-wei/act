## Why

The UI report shows that the platform already has `ThemeProvider`, CSS variables, `surface-*` helpers, and class-based dark mode, but role areas and product modules still carry separate headers, local palettes, and page-level shell rules. The future OpenSpec baseline makes this more urgent: simulations, Arena, ResourceNodes, learner state, path planning, Konling, and governance views will all expose shared status and navigation semantics.

## What Changes

- Establish a platform design-system foundation for semantic tokens, shell layout, header/sidebar/breadcrumb contracts, theme switching, and shared card/action primitives.
- Define a role-aware `AppShell` and navigation schema that can replace `FeaturePageNav`, `UnifiedTopBar`, `ArenaPageShell`, `TeacherLayout`, and `AdminConsoleHeader` through staged adapters.
- Add guardrails for new UI surfaces so future active changes do not introduce new page-local palettes or shell variants.
- Codify platform ownership boundaries so shared UI primitives do not absorb course, ResourceNode, Arena, simulation, or adaptive business orchestration.
- Keep existing pages operational while migration changes consume the new shell behind feature flags.

## Capabilities

### New Capabilities
- `platform-design-system-and-shell`: Defines token, shell, navigation, and migration contracts for the platform UI foundation.

## Impact

- Affects `src/app/globals.css`, `tailwind.config.ts`, `src/components/providers/theme-provider.tsx`, shared navigation/header components, role layouts, and future UI changes.
- Defines boundaries between `src/components`, `src/features`, `src/resources`, and course-resource registry consumers.
- Does not implement product-module migrations; downstream UI changes consume this foundation.
