## Context

The current platform has a usable theme foundation but not a single product shell. `surface-page`, `surface-card`, and semantic Tailwind colors coexist with direct `bg-slate-*`, local hex palettes, and multiple independent headers. The correct foundation is evolutionary: keep the existing theme model and formalize it into one platform shell rather than replacing every page at once.

## Goals / Non-Goals

Goals:

- Define semantic UI tokens and component contracts for shell, header, sidebar, breadcrumb, cards, status chips, actions, drawers, and modals.
- Make role navigation data-driven and reusable by student, teacher, and admin surfaces.
- Provide adapter paths for current shell components so downstream changes can migrate incrementally.
- Preserve the repository ownership model: platform primitives in `src/components`, feature orchestration in `src/features`, resource implementations in `src/resources`, and course-resource resolution through the registry and lesson engine.

Non-goals:

- No broad page rewrite in this change.
- No product module information-architecture changes beyond the shared shell contract.
- No removal of legacy shell components until downstream migrations have landed.
- No movement of course, Arena, ResourceNode, simulation, adaptive, or governance business rules into shared UI primitives.

## Decisions

### Extend the existing token system

The change should keep class-based dark mode and existing CSS-variable semantics, then add named platform tokens for canvas, surface levels, border, foreground, accent, success, warning, danger, privacy, evidence, replay, and evaluation states.

### Treat shell as infrastructure

`AppShell` owns the global page frame, role context, responsive navigation, breadcrumbs, theme switcher, user menu slot, and page action slot. Product modules own their inner workflow layout.

### Migrate through adapters

Existing headers and shells remain usable while wrappers route their visual treatment through the new primitives. That avoids a single high-risk replacement batch.

### Keep primitives presentation-only

`AppShell`, surface primitives, navigation renderers, and shared status components receive role, navigation, action, and status props from feature-owned containers. They must not import feature services, resource implementations, lesson runtime internals, or ResourceNode/Arena/adaptive domain modules.

## Risks

- A token-only change can become cosmetic if not tied to migration rules. The spec must require new surfaces to use the shared primitives.
- A too-generic shell can flatten module workflows. Keep product-specific workspaces inside the shell.

## Verification

- Strict OpenSpec validation for this change.
- Unit or source tests for token availability, role navigation schema, and shell adapter usage.
- Source checks for shared UI boundary violations, especially feature imports inside `src/components` primitives.
- Visual smoke checks for at least one student, teacher, admin, Arena, and simulation page after downstream migrations consume the shell.
